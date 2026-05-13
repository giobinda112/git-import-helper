/**
 * =============================================================================
 * ORDERFIX - Google Apps Script Backend (Clean Version)
 * =============================================================================
 * 
 * SETUP:
 * 1. Open Google Spreadsheet > Extensions > Apps Script
 * 2. Delete all code and paste this entire script
 * 3. Save (Ctrl+S)
 * 4. Deploy > New deployment > Web app
 * 5. Execute as: "Me" | Who has access: "Anyone"
 * 6. Copy the Web App URL as your Webhook
 * 
 * IMPORTANT: Create a NEW deployment after any code changes!
 *
 * HEADERS (row 1): Do NOT maintain them by hand. Every successful POST/sync
 * rewrites row 1 with the correct titles and then writes all data rows.
 * If you deleted row 1, leave it empty — the next sync from the app recreates it.
 * Sheet names must stay: Fixtures, VesselsOnSubs, MasterVessels, MasterPorts.
 * =============================================================================
 */

// Sheet names
var SHEET_FIXTURES = 'Fixtures';
var SHEET_SUBS = 'VesselsOnSubs';
var SHEET_VESSELS = 'MasterVessels';
var SHEET_PORTS = 'MasterPorts';

// Headers
var HEADERS_FIXTURES = ['id', 'dateAdded', 'charterers', 'vessel', 'owner', 'dwt', 'yob', 'qty', 'grade', 'loadPort', 'dischargePort', 'laycan', 'rate', 'status', 'dem', 'comments', 'area', 'archived', 'private', 'editHistory'];
var HEADERS_SUBS = ['id', 'dateAdded', 'vessel', 'owner', 'dwt', 'yob', 'position', 'openDate', 'comments', 'archived'];
/**
 * Master sheets: row 1 = human labels; JSON from the app still uses vesselName / portName.
 */
var KEYS_VESSELS = ['vesselName', 'owner', 'dwt', 'yob'];
var KEYS_PORTS = ['portName', 'area'];
var DISPLAY_VESSELS = ['Vessel', 'Owner', 'DWT', 'YOB'];
var DISPLAY_PORTS = ['Port name', 'Area'];

/**
 * GET - Fetch all data
 */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : 'pull';
  var data;
  
  try {
    Logger.log('doGet called - action: ' + action);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    
    data = {
      fixtures: readSheet(ss, SHEET_FIXTURES, HEADERS_FIXTURES),
      vesselsOnSubs: readSheet(ss, SHEET_SUBS, HEADERS_SUBS),
      masterVessels: readSheet(ss, SHEET_VESSELS, KEYS_VESSELS),
      masterPorts: readSheet(ss, SHEET_PORTS, KEYS_PORTS)
    };
    
    data.anagrafiche = buildAnagrafiche(data);
    
    Logger.log('doGet success - fixtures: ' + data.fixtures.length);
    
    var result = JSON.stringify({ status: 'success', data: data });
    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doGet ERROR: ' + error.message + '\n' + error.stack);
    
    var result = JSON.stringify({ status: 'error', message: error.message });
    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST - Save data
 */
function doPost(e) {
  try {
    Logger.log('doPost called');
    
    // Parse request
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST data received');
    }
    
    var payload = JSON.parse(e.postData.contents);
    Logger.log('Payload keys: ' + Object.keys(payload).join(', '));
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    
    // Get data (handle both {action, data} and direct format)
    var data = payload.data || payload;
    
    // Save each type
    if (data.fixtures && Array.isArray(data.fixtures)) {
      Logger.log('Saving ' + data.fixtures.length + ' fixtures');
      writeSheet(ss, SHEET_FIXTURES, data.fixtures, HEADERS_FIXTURES);
    }
    
    if (data.vesselsOnSubs && Array.isArray(data.vesselsOnSubs)) {
      Logger.log('Saving ' + data.vesselsOnSubs.length + ' subs');
      writeSheet(ss, SHEET_SUBS, data.vesselsOnSubs, HEADERS_SUBS);
    }
    
    if (data.masterVessels && Array.isArray(data.masterVessels)) {
      Logger.log('Saving ' + data.masterVessels.length + ' vessels');
      writeSheet(ss, SHEET_VESSELS, data.masterVessels, KEYS_VESSELS, DISPLAY_VESSELS);
    }
    
    if (data.masterPorts && Array.isArray(data.masterPorts)) {
      Logger.log('Saving ' + data.masterPorts.length + ' ports');
      writeSheet(ss, SHEET_PORTS, data.masterPorts, KEYS_PORTS, DISPLAY_PORTS);
    }
    
    // Return updated data
    var responseData = {
      fixtures: readSheet(ss, SHEET_FIXTURES, HEADERS_FIXTURES),
      vesselsOnSubs: readSheet(ss, SHEET_SUBS, HEADERS_SUBS),
      masterVessels: readSheet(ss, SHEET_VESSELS, KEYS_VESSELS),
      masterPorts: readSheet(ss, SHEET_PORTS, KEYS_PORTS)
    };
    responseData.anagrafiche = buildAnagrafiche(responseData);
    
    Logger.log('doPost success');
    
    var result = JSON.stringify({ status: 'success', data: responseData });
    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost ERROR: ' + error.message + '\n' + error.stack);
    
    var result = JSON.stringify({ status: 'error', message: error.message });
    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize sheets with headers
 */
function initSheets(ss) {
  createSheet(ss, SHEET_FIXTURES, HEADERS_FIXTURES);
  createSheet(ss, SHEET_SUBS, HEADERS_SUBS);
  createSheet(ss, SHEET_VESSELS, KEYS_VESSELS, DISPLAY_VESSELS);
  createSheet(ss, SHEET_PORTS, KEYS_PORTS, DISPLAY_PORTS);
}

/** displayHeaders: optional row-1 labels (e.g. Vessel / Port name). keys = object property names. */
function createSheet(ss, name, keys, displayHeaders) {
  displayHeaders = displayHeaders || keys;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    Logger.log('Creating sheet: ' + name);
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, displayHeaders.length).setValues([displayHeaders]);
    sheet.getRange(1, 1, 1, displayHeaders.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Map header cell text -> canonical field name (must match HEADERS_* arrays).
 * Fixes Italian sheets ("Data" -> dateAdded) so columns are not read by position (which swaps laycan vs date).
 */
function slugifySheetHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[\s_.-]+/g, '');
}

function resolveSheetColumnKey(rawHeader, expectedHeaders) {
  var exact = String(rawHeader || '').trim();
  var i;
  for (i = 0; i < expectedHeaders.length; i++) {
    if (expectedHeaders[i] === exact) return expectedHeaders[i];
  }
  var slug = slugifySheetHeader(rawHeader);
  var syn = {
    'id': 'id',
    'dateadded': 'dateAdded',
    'date': 'dateAdded',
    'data': 'dateAdded',
    'datainserimento': 'dateAdded',
    'inzerta': 'dateAdded',
    'submissiondate': 'dateAdded',
    'charterers': 'charterers',
    'charterer': 'charterers',
    'vessel': 'vessel',
    'owner': 'owner',
    'dwt': 'dwt',
    'yob': 'yob',
    'qty': 'qty',
    'grade': 'grade',
    'loadport': 'loadPort',
    'load': 'loadPort',
    'carico': 'loadPort',
    'portocarico': 'loadPort',
    'portodicarico': 'loadPort',
    'portoload': 'loadPort',
    'dischargeport': 'dischargePort',
    'disch': 'dischargePort',
    'discarica': 'dischargePort',
    'scarico': 'dischargePort',
    'portodiscarica': 'dischargePort',
    'portodiscarico': 'dischargePort',
    'dischport': 'dischargePort',
    'dport': 'dischargePort',
    'nave': 'vessel',
    'ship': 'vessel',
    'imbarcazione': 'vessel',
    'laycan': 'laycan',
    'rate': 'rate',
    'status': 'status',
    'dem': 'dem',
    'comments': 'comments',
    'note': 'comments',
    'area': 'area',
    'archived': 'archived',
    'private': 'private',
    'edithistory': 'editHistory'
  };
  var field = syn[slug];
  if (field && expectedHeaders.indexOf(field) >= 0) return field;
  /** MasterVessels: column "Vessel" / "Nave" -> vesselName (Fixtures sheet uses key "vessel" instead). */
  if (expectedHeaders.indexOf('vesselName') >= 0 && expectedHeaders.indexOf('vessel') < 0) {
    if (slug === 'vessel' || slug === 'vesselname' || slug === 'name' || slug === 'nave' || slug === 'ship') return 'vesselName';
  }
  /** MasterPorts: "Port name", "Port", "Nome porto" (not used when vesselName column exists). */
  if (expectedHeaders.indexOf('portName') >= 0 && expectedHeaders.indexOf('vesselName') < 0) {
    if (slug === 'portname' || slug === 'port' || slug === 'name' || slug === 'nomeporto') return 'portName';
  }
  return null;
}

function buildColumnKeyToIndex(sheetHeaders, expectedHeaders) {
  var map = {};
  var c;
  for (c = 0; c < sheetHeaders.length; c++) {
    var key = resolveSheetColumnKey(sheetHeaders[c], expectedHeaders);
    if (key && map[key] === undefined) map[key] = c;
  }
  return map;
}

/**
 * Read sheet data as array of objects (column order independent).
 */
function readSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < 2 || lastCol < 1) return [];
  
  var sheetHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colMap = buildColumnKeyToIndex(sheetHeaders, headers);
  /** Row 1 = headers; data is rows 2 … lastRow (inclusive). */
  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  
  var result = [];
  var i;
  for (i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    var hasData = false;
    
    var j;
    for (j = 0; j < headers.length; j++) {
      var key = headers[j];
      var ci = colMap[key];
      var val = ci !== undefined ? row[ci] : '';
      
      if (val === null || val === undefined || val === '') {
        obj[key] = '';
      } else if (val instanceof Date) {
        var tz = Session.getScriptTimeZone();
        if (key === 'laycan') {
          obj[key] = Utilities.formatDate(val, tz, 'dd/MM/yyyy');
        } else if (key === 'dateAdded') {
          obj[key] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        } else {
          obj[key] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        }
      } else if (key === 'archived' || key === 'private') {
        obj[key] = val === true || val === 'true' || val === 'TRUE';
      } else if (key === 'editHistory') {
        try {
          obj[key] = typeof val === 'string' ? JSON.parse(val) : val;
        } catch (e) {
          obj[key] = [];
        }
      } else {
        obj[key] = String(val);
        hasData = true;
      }
    }
    
    if (hasData || obj.id) {
      result.push(obj);
    }
  }
  
  return result;
}

/**
 * Write array of objects to sheet (replaces all data).
 * keys = property names on each object; displayHeaders = row 1 text (defaults to keys).
 */
function writeSheet(ss, name, data, keys, displayHeaders) {
  displayHeaders = displayHeaders || keys;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = name === SHEET_VESSELS ? createSheet(ss, name, KEYS_VESSELS, DISPLAY_VESSELS)
      : name === SHEET_PORTS ? createSheet(ss, name, KEYS_PORTS, DISPLAY_PORTS)
      : createSheet(ss, name, keys);
  }
  
  // Clear all data rows (keep row 1; will overwrite headers next)
  var lastRow = sheet.getLastRow();
  var lastColClear = Math.max(sheet.getLastColumn() || 0, keys.length);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow, lastColClear).clear();
  }
  
  sheet.getRange(1, 1, 1, displayHeaders.length).setValues([displayHeaders]);
  
  var prevCols = sheet.getLastColumn();
  if (prevCols > keys.length) {
    sheet.deleteColumns(keys.length + 1, prevCols - keys.length);
  }
  
  if (!data || data.length === 0) return;
  
  // Build rows
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var obj = data[i];
    var row = [];
    
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var val = obj[key];
      if ((val === undefined || val === null || val === '') && key === 'vesselName') {
        val = obj.name;
      }
      if ((val === undefined || val === null || val === '') && key === 'portName') {
        val = obj.name;
      }
      
      if (val === undefined || val === null) {
        row.push('');
      } else if (key === 'editHistory' && typeof val === 'object') {
        row.push(JSON.stringify(val));
      } else if (typeof val === 'boolean') {
        row.push(val);
      } else {
        row.push(String(val));
      }
    }
    rows.push(row);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, keys.length).setValues(rows);
  }

  /** Force plain text so Sheets does not convert ISO dates / laycan ranges into Date objects. */
  var lr2 = sheet.getLastRow();
  if (lr2 >= 2) {
    var laycanCol = keys.indexOf('laycan');
    if (laycanCol >= 0) {
      sheet.getRange(2, laycanCol + 1, lr2, laycanCol + 1).setNumberFormat('@');
    }
    var dateAddedCol = keys.indexOf('dateAdded');
    if (dateAddedCol >= 0) {
      sheet.getRange(2, dateAddedCol + 1, lr2, dateAddedCol + 1).setNumberFormat('@');
    }
    var vnCol = keys.indexOf('vesselName');
    if (vnCol >= 0) {
      sheet.getRange(2, vnCol + 1, lr2, vnCol + 1).setNumberFormat('@');
    }
    var pnCol = keys.indexOf('portName');
    if (pnCol >= 0) {
      sheet.getRange(2, pnCol + 1, lr2, pnCol + 1).setNumberFormat('@');
    }
    /** Fixtures: avoid Sheets turning vessel / port names into dates or numbers. */
    var forceText = { id: 1, charterers: 1, vessel: 1, owner: 1, qty: 1, grade: 1, loadPort: 1, dischargePort: 1, rate: 1, status: 1, dem: 1, comments: 1, yob: 1 };
    var k;
    for (k = 0; k < keys.length; k++) {
      if (forceText[keys[k]]) {
        sheet.getRange(2, k + 1, lr2, k + 1).setNumberFormat('@');
      }
    }
  }
}

/**
 * Build anagrafiche (autocomplete data)
 */
function buildAnagrafiche(data) {
  var charterers = {};
  var vessels = {};
  var owners = {};
  var ports = {};
  var loadPorts = {};
  var dischargePorts = {};
  var grades = {};
  
  function addSplitPorts(raw, bucket) {
    if (!raw) return;
    var parts = String(raw).split('-');
    for (var i = 0; i < parts.length; i++) {
      var port = parts[i].trim().toUpperCase();
      if (port) bucket[port] = true;
    }
  }
  
  // From fixtures
  var fixtures = data.fixtures || [];
  for (var i = 0; i < fixtures.length; i++) {
    var f = fixtures[i];
    if (f.charterers) charterers[f.charterers.toUpperCase()] = true;
    if (f.vessel) vessels[f.vessel.toUpperCase()] = true;
    if (f.owner) owners[f.owner.toUpperCase()] = true;
    if (f.loadPort) {
      ports[f.loadPort.toUpperCase()] = true;
      addSplitPorts(f.loadPort, loadPorts);
    }
    if (f.dischargePort) {
      ports[f.dischargePort.toUpperCase()] = true;
      addSplitPorts(f.dischargePort, dischargePorts);
    }
    if (f.grade) grades[f.grade.toUpperCase()] = true;
  }
  
  // From subs
  var subs = data.vesselsOnSubs || [];
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i];
    if (s.vessel) vessels[s.vessel.toUpperCase()] = true;
    if (s.owner) owners[s.owner.toUpperCase()] = true;
  }
  
  // From master vessels
  var mv = data.masterVessels || [];
  for (var i = 0; i < mv.length; i++) {
    var v = mv[i];
    var vn = v.vesselName || v.name;
    if (vn) vessels[String(vn).toUpperCase()] = true;
    if (v.owner) owners[v.owner.toUpperCase()] = true;
  }
  
  // From master ports
  var mp = data.masterPorts || [];
  for (var i = 0; i < mp.length; i++) {
    var p = mp[i];
    var pn = p.portName || p.name;
    if (pn) ports[String(pn).toUpperCase()] = true;
  }
  
  return {
    charterers: Object.keys(charterers).sort(),
    vessels: Object.keys(vessels).sort(),
    owners: Object.keys(owners).sort(),
    ports: Object.keys(ports).sort(),
    loadPorts: Object.keys(loadPorts).sort(),
    dischargePorts: Object.keys(dischargePorts).sort(),
    grades: Object.keys(grades).sort()
  };
}

// =============================================================================
// TEST FUNCTIONS - Run from Apps Script editor (Run > testScript)
// =============================================================================

function testScript() {
  Logger.log('=== TEST START ===');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet: ' + ss.getName());
  
  initSheets(ss);
  Logger.log('Sheets initialized');
  
  var fixtures = readSheet(ss, SHEET_FIXTURES, HEADERS_FIXTURES);
  Logger.log('Fixtures: ' + fixtures.length);
  
  Logger.log('=== TEST OK ===');
}

function testPost() {
  var e = {
    postData: {
      contents: JSON.stringify({
        action: 'sync4',
        data: {
          fixtures: [{
            id: 'test-' + Date.now(),
            dateAdded: new Date().toISOString().split('T')[0],
            charterers: 'TEST CHARTERER',
            vessel: 'TEST VESSEL',
            status: 'FIXED'
          }]
        }
      })
    }
  };
  
  var result = doPost(e);
  Logger.log('Result: ' + result.getContent());
}

function clearTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixtures = readSheet(ss, SHEET_FIXTURES, HEADERS_FIXTURES);
  
  var clean = fixtures.filter(function(f) {
    return !f.id.startsWith('test-');
  });
  
  writeSheet(ss, SHEET_FIXTURES, clean, HEADERS_FIXTURES);
  Logger.log('Cleaned ' + (fixtures.length - clean.length) + ' test entries');
}
