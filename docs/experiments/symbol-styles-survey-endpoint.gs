/**
 * Receives the survey answers of symbol-styles-comparison.html and appends one row per submission to
 * the sheet this script is bound to. Not part of the app; nothing in the app calls it.
 *
 * Set up:
 *  1. Create a Google Sheet, then Extensions > Apps Script, and paste this file in.
 *  2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *  3. Copy the web app URL (it ends in /exec) and build the page with it:
 *       SURVEY_ENDPOINT=<the url> node gen_styles.mjs out.html
 *     Do not commit the URL: anyone who has it can write rows.
 *  4. After editing this script, Deploy > Manage deployments > edit > New version, or the old code keeps running.
 *
 * The endpoint is open, so it only accepts what the form can produce: whole numbers 1 to 5 for each of
 * A, B and C, a BPMN level 0 to 4, and a short round id. The text of the BPMN level comes from this
 * file, never from the request, so nothing typed by a stranger reaches the sheet. A filled-in honeypot
 * field is dropped silently, and the sheet stops growing at MAX_ROWS.
 */
var SHEET_NAME = 'Svar'
var MAX_ROWS = 5000
var HEADERS = [
  'tid', 'runde',
  'enkel_A', 'enkel_B', 'enkel_C',
  'velkommen_A', 'velkommen_B', 'velkommen_C',
  'bpmn_nivaa', 'bpmn_tekst'
]
var BPMN_LEVELS = ['Ukjent', 'Har hørt om det', 'Har vært borti det', 'Har brukt det en del', 'Har dyp og lang erfaring']

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents)
    if (d.website) return reply_({ ok: true }) // the honeypot: a person never fills it in
    var row = toRow_(d)
    if (!row) return reply_({ ok: false, error: 'invalid' })

    var lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      var sheet = sheet_()
      if (sheet.getLastRow() >= MAX_ROWS) return reply_({ ok: false, error: 'full' })
      sheet.appendRow(row)
    } finally {
      lock.releaseLock()
    }
    return reply_({ ok: true })
  } catch (err) {
    return reply_({ ok: false, error: 'failed' })
  }
}

// Opening the URL in a browser says the endpoint is alive, nothing more.
function doGet() {
  return reply_({ ok: true })
}

function toRow_(d) {
  var round = String(d.round || '')
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(round)) return null
  var easy = ratings_(d.easy)
  var welcoming = ratings_(d.welcoming)
  var bpmn = d.bpmn
  if (!easy || !welcoming) return null
  if (typeof bpmn !== 'number' || bpmn % 1 !== 0 || bpmn < 0 || bpmn >= BPMN_LEVELS.length) return null
  return [new Date(), round].concat(easy, welcoming, [bpmn, BPMN_LEVELS[bpmn]])
}

function ratings_(o) {
  if (!o) return null
  var out = []
  var keys = ['A', 'B', 'C']
  for (var i = 0; i < keys.length; i++) {
    var v = o[keys[i]]
    if (typeof v !== 'number' || v % 1 !== 0 || v < 1 || v > 5) return null
    out.push(v)
  }
  return out
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS)
  return sheet
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
