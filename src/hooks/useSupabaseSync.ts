import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Fixture, Anagrafiche, FieldEdit, Area, PortMapping, VesselOwner, Status } from '../types';

function fixtureToRow(f: Fixture) {
  return {
    date_added: f.dateAdded,
    charterers: f.charterers,
    qty: f.qty,
    load_port: f.loadPort,
    discharge_port: f.dischargePort,
    laycan: f.laycan,
    vessel: f.vessel,
    rate: f.rate,
    status: f.status,
    grade: f.grade,
    area: f.area,
    dem: f.dem,
    comments: f.comments,
    position: f.position,
    open_date: f.openDate,
    edit_history: f.editHistory as unknown as object[],
    archived: f.archived,
    private: f.private,
  };
}

function rowToFixture(row: Record<string, unknown>): Fixture {
  return {
    id: row.id as string,
    dateAdded: (row.date_added as string) || '',
    charterers: (row.charterers as string) || '',
    qty: (row.qty as string) || '',
    loadPort: (row.load_port as string) || '',
    dischargePort: (row.discharge_port as string) || '',
    laycan: (row.laycan as string) || '',
    vessel: (row.vessel as string) || '',
    rate: (row.rate as string) || '',
    status: ((row.status as string) || '') as Status,
    grade: (row.grade as string) || '',
    area: ((row.area as string) || 'Other') as Area,
    dem: (row.dem as string) || '',
    comments: (row.comments as string) || '',
    position: (row.position as string) || '',
    openDate: (row.open_date as string) || '',
    editHistory: (row.edit_history as FieldEdit[]) || [],
    archived: (row.archived as boolean) || false,
    private: (row.private as boolean) || false,
  };
}

export function useSupabaseSync(
  fixtures: Fixture[],
  anagrafiche: Anagrafiche,
  setFixtures: (f: Fixture[]) => void,
  setAnagrafiche: (a: Anagrafiche) => void,
) {
  const initialLoadDone = useRef(false);
  const syncingRef = useRef(false);

  // Load all data from Supabase on mount
  const loadFromSupabase = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const [fixRes, voRes, pmRes, chRes, grRes] = await Promise.all([
        supabase.from('fixtures').select('*').order('date_added', { ascending: false }),
        supabase.from('vessel_owners').select('*').order('vessel_name'),
        supabase.from('port_mappings').select('*').order('port_name'),
        supabase.from('charterers').select('*').order('name'),
        supabase.from('grades').select('*').order('name'),
      ]);

      const dbFixtures = (fixRes.data || []).map(rowToFixture);
      const vesselOwners: VesselOwner[] = (voRes.data || []).map((r: Record<string, unknown>) => ({
        vesselName: (r.vessel_name as string) || '',
        owner: (r.owner as string) || '',
        dwt: (r.dwt as string) || '',
      }));
      const portMappings: PortMapping[] = (pmRes.data || []).map((r: Record<string, unknown>) => ({
        portName: (r.port_name as string) || '',
        area: (r.area as string) as Area || 'Other',
      }));
      const charterers: string[] = (chRes.data || []).map((r: Record<string, unknown>) => (r.name as string) || '');
      const grades: string[] = (grRes.data || []).map((r: Record<string, unknown>) => (r.name as string) || '');

      // Build load/discharge port lists from port_mappings
      const loadPorts = portMappings.map(pm => pm.portName).sort();
      const dischargePorts = [...loadPorts];
      const vessels = vesselOwners.map(vo => vo.vesselName).sort();

      const dbAnagrafiche: Anagrafiche = {
        charterers,
        vessels,
        loadPorts,
        dischargePorts,
        grades,
        portMappings,
        vesselOwners,
      };

      if (dbFixtures.length > 0) {
        setFixtures(dbFixtures);
      }
      if (charterers.length > 0 || vesselOwners.length > 0 || portMappings.length > 0) {
        setAnagrafiche(dbAnagrafiche);
      }
    } catch (err) {
      console.error('Failed to load from Supabase:', err);
    } finally {
      syncingRef.current = false;
      initialLoadDone.current = true;
    }
  }, [setFixtures, setAnagrafiche]);

  // Push fixtures to Supabase
  const pushFixtures = useCallback(async (newFixtures: Fixture[]) => {
    if (!initialLoadDone.current) return;
    try {
      // Upsert all fixtures
      const rows = newFixtures.map(f => ({ id: f.id, ...fixtureToRow(f) }));
      const { error } = await supabase.from('fixtures').upsert(rows, { onConflict: 'id' });
      if (error) console.error('Failed to push fixtures:', error);
    } catch (err) {
      console.error('Failed to push fixtures:', err);
    }
  }, []);

  // Push anagrafiche to Supabase
  const pushAnagrafiche = useCallback(async (newAnagrafiche: Anagrafiche) => {
    if (!initialLoadDone.current) return;
    try {
      // Upsert vessel owners
      const voRows = newAnagrafiche.vesselOwners.map(vo => ({
        vessel_name: vo.vesselName,
        owner: vo.owner,
        dwt: vo.dwt,
      }));
      if (voRows.length > 0) {
        await supabase.from('vessel_owners').upsert(voRows, { onConflict: 'vessel_name' });
      }

      // Upsert port mappings
      const pmRows = newAnagrafiche.portMappings.map(pm => ({
        port_name: pm.portName,
        area: pm.area,
      }));
      if (pmRows.length > 0) {
        await supabase.from('port_mappings').upsert(pmRows, { onConflict: 'port_name' });
      }

      // Upsert charterers
      const chRows = newAnagrafiche.charterers.map(name => ({ name }));
      if (chRows.length > 0) {
        await supabase.from('charterers').upsert(chRows, { onConflict: 'name' });
      }

      // Upsert grades
      const grRows = newAnagrafiche.grades.map(name => ({ name }));
      if (grRows.length > 0) {
        await supabase.from('grades').upsert(grRows, { onConflict: 'name' });
      }
    } catch (err) {
      console.error('Failed to push anagrafiche:', err);
    }
  }, []);

  // Delete a fixture from Supabase
  const deleteFixtureFromDb = useCallback(async (id: string) => {
    try {
      await supabase.from('fixtures').delete().eq('id', id);
    } catch (err) {
      console.error('Failed to delete fixture:', err);
    }
  }, []);

  // Auto-sync: push to Supabase when local data changes
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timer = setTimeout(() => {
      pushFixtures(fixtures);
    }, 1000);
    return () => clearTimeout(timer);
  }, [fixtures, pushFixtures]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timer = setTimeout(() => {
      pushAnagrafiche(anagrafiche);
    }, 1000);
    return () => clearTimeout(timer);
  }, [anagrafiche, pushAnagrafiche]);

  return { loadFromSupabase, pushFixtures, pushAnagrafiche, deleteFixtureFromDb };
}
