/**
 * Google Apps Script — doPost(e) companion for atomic fixture sync + tombstones.
 * Wire your sheet column headers to match keys on `row` (id, dateAdded, charterers, … editHistory as JSON string).
 *
 * Actions (JSON body as e.postData.contents — same as frontend text/plain POST):
 * - rowUpsert4: { action: 'rowUpsert4', row: { ...FixtureSheetPayload } }
 * - fixtureDelete4: { action: 'fixtureDelete4', id: '...' }
 * - subsRowUpsert4: { action: 'subsRowUpsert4', row: { id, vessel, port, openDate, dateAdded } }
 * - subsRowDelete4: { action: 'subsRowDelete4', id: '...' }
 * - metaSync4: { action: 'metaSync4', data: { anagrafiche, vesselsOnSubs, masterVessels, masterPorts } }
 *
 * Tombstones: when a fixture row is removed via fixtureDelete4, store its id so a stale client
 * cannot re-append the same id later. Prune the list periodically (e.g. keep last 5000 ids).
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid json' }));
  }
  var action = body.action;

  if (action === 'rowUpsert4') {
    return handleRowUpsert_(body.row);
  }
  if (action === 'fixtureDelete4') {
    return handleFixtureDelete_(body.id);
  }
  if (action === 'subsRowUpsert4') {
    return handleSubsUpsert_(body.row);
  }
  if (action === 'subsRowDelete4') {
    return handleSubsDelete_(body.id);
  }
  if (action === 'metaSync4') {
    return handleMetaSync_(body.data);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown action' }));
}

function tombstoneKey_() {
  return 'FIXTURE_TOMBSTONES_JSON';
}

function readTombstones_() {
  var raw = PropertiesService.getScriptProperties().getProperty(tombstoneKey_());
  if (!raw) return [];
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeTombstones_(ids) {
  var uniq = [];
  var seen = {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (!id || seen[id]) continue;
    seen[id] = true;
    uniq.push(id);
  }
  if (uniq.length > 5000) uniq = uniq.slice(uniq.length - 5000);
  PropertiesService.getScriptProperties().setProperty(tombstoneKey_(), JSON.stringify(uniq));
}

function addTombstone_(id) {
  if (!id) return;
  var t = readTombstones_();
  t.push(String(id));
  writeTombstones_(t);
}

function removeTombstone_(id) {
  var t = readTombstones_().filter(function (x) {
    return x !== String(id);
  });
  writeTombstones_(t);
}

/** TODO: return your Fixtures sheet */
function getFixturesSheet_() {
  // return SpreadsheetApp.openById('...').getSheetByName('Fixtures');
  throw new Error('Implement getFixturesSheet_');
}

function headerIndexMap_(headerRow) {
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var h = String(headerRow[c] || '')
      .trim()
      .toLowerCase();
    if (h) map[h] = c;
  }
  return map;
}

function handleRowUpsert_(row) {
  if (!row || !row.id) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'missing row.id' }));
  }
  var id = String(row.id);
  var sh = getFixturesSheet_();
  var values = sh.getDataRange().getValues();
  if (!values.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'empty sheet' }));
  }
  var headers = values[0].map(function (h) {
    return String(h || '').trim();
  });
  var lower = headerIndexMap_(values[0]);
  var idCol = lower['id'];
  if (idCol === undefined) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "no 'id' column" }));
  }

  var dataRow = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol] || '').trim() === id) {
      dataRow = r + 1;
      break;
    }
  }

  var tomb = readTombstones_();
  var isTomb = tomb.indexOf(id) !== -1;

  if (dataRow === -1) {
    if (isTomb) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'tombstoned', id: id }));
    }
    var newR = sh.getLastRow() + 1;
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c] || '')
        .trim()
        .toLowerCase();
      if (!key) continue;
      if (row[key] !== undefined) sh.getRange(newR, c + 1).setValue(serializeCell_(key, row[key]));
      else if (row[headers[c]] !== undefined) sh.getRange(newR, c + 1).setValue(serializeCell_(headers[c], row[headers[c]]));
    }
    removeTombstone_(id);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, mode: 'append', id: id }));
  }

  for (var c2 = 0; c2 < headers.length; c2++) {
    var key2 = String(headers[c2] || '')
      .trim()
      .toLowerCase();
    if (!key2 || key2 === 'id') continue;
    if (row[key2] !== undefined) sh.getRange(dataRow, c2 + 1).setValue(serializeCell_(key2, row[key2]));
    else if (row[headers[c2]] !== undefined) sh.getRange(dataRow, c2 + 1).setValue(serializeCell_(headers[c2], row[headers[c2]]));
  }
  removeTombstone_(id);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, mode: 'update', id: id }));
}

function serializeCell_(key, val) {
  if ((key === 'edithistory' || key === 'editHistory') && typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

function handleFixtureDelete_(id) {
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'missing id' }));
  }
  var sid = String(id);
  var sh = getFixturesSheet_();
  var values = sh.getDataRange().getValues();
  var lower = headerIndexMap_(values[0]);
  var idCol = lower['id'];
  if (idCol === undefined) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "no 'id' column" }));
  }
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol] || '').trim() === sid) {
      sh.deleteRow(r + 1);
      addTombstone_(sid);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, deleted: sid }));
    }
  }
  addTombstone_(sid);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, alreadyMissing: sid }));
}

function handleSubsUpsert_(row) {
  // Implement: find VesselsOnSubs sheet by id, update row or append.
  return ContentService.createTextOutput(JSON.stringify({ ok: true, stub: 'subsRowUpsert4' }));
}

function handleSubsDelete_(id) {
  // Implement: delete row with id on VesselsOnSubs sheet.
  return ContentService.createTextOutput(JSON.stringify({ ok: true, stub: 'subsRowDelete4' }));
}

function handleMetaSync_(data) {
  // Implement: merge anagrafiche / master tabs / full subs list as you do today.
  return ContentService.createTextOutput(JSON.stringify({ ok: true, stub: 'metaSync4' }));
}
