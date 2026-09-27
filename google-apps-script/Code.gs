const FEEDBACK_PROPERTY_KEYS = {
  formId: 'FEEDBACK_FORM_ID',
  nameItemId: 'FEEDBACK_NAME_ITEM_ID',
  subjectItemId: 'FEEDBACK_SUBJECT_ITEM_ID',
  messageItemId: 'FEEDBACK_MESSAGE_ITEM_ID',
  notificationEmail: 'FEEDBACK_NOTIFICATION_EMAIL'
};
const FEEDBACK_FORM_ID = '1P3vKQ6khx8WuaNZekzrtt6B4DFp04x8NZCmuOqQN2xQ';

function setupFeedbackIntegration() {
  const properties = PropertiesService.getScriptProperties();
  const form = FormApp.openById(FEEDBACK_FORM_ID);
  const nameItem = findFeedbackItem_(form, 'Name', FormApp.ItemType.TEXT).asTextItem();
  const subjectItem = findFeedbackItem_(form, 'Subject', FormApp.ItemType.TEXT).asTextItem();
  const messageItem = findFeedbackItem_(form, 'Message', FormApp.ItemType.PARAGRAPH_TEXT).asParagraphTextItem();

  properties.setProperties({
    [FEEDBACK_PROPERTY_KEYS.formId]: form.getId(),
    [FEEDBACK_PROPERTY_KEYS.nameItemId]: String(nameItem.getId()),
    [FEEDBACK_PROPERTY_KEYS.subjectItemId]: String(subjectItem.getId()),
    [FEEDBACK_PROPERTY_KEYS.messageItemId]: String(messageItem.getId())
  });

  const notificationEmail = Session.getEffectiveUser().getEmail();
  if (!notificationEmail) {
    throw new Error('Google did not provide the authorizing account email. Set FEEDBACK_NOTIFICATION_EMAIL in Script Properties, then run setup again.');
  }
  properties.setProperty(FEEDBACK_PROPERTY_KEYS.notificationEmail, notificationEmail);

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sendFeedbackNotification')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendFeedbackNotification')
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log('Feedback form responder URL: ' + form.getPublishedUrl());
  Logger.log('Feedback form editor URL: ' + form.getEditUrl());
  Logger.log('Notification email: ' + notificationEmail);
}

function findFeedbackItem_(form, title, expectedType) {
  const item = form.getItems().find(candidate => candidate.getTitle() === title);
  if (!item) throw new Error('The Google Form is missing a question titled "' + title + '".');
  if (item.getType() !== expectedType) {
    throw new Error('The "' + title + '" question has the wrong type. Check google-apps-script/SETUP.md.');
  }
  return item;
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const requestId = String(parameters.requestId || '').slice(0, 80);

  try {
    if (String(parameters.website || '').trim()) {
      return feedbackResponse_(true, requestId);
    }

    const name = String(parameters.name || '').trim();
    const subject = String(parameters.subject || '').trim();
    const message = String(parameters.message || '').trim();
    if (!subject || !message) throw new Error('Subject and message are required.');
    if (name.length > 100 || subject.length > 150 || message.length > 5000) {
      throw new Error('A feedback field exceeded its maximum length.');
    }

    const properties = PropertiesService.getScriptProperties();
    const form = FormApp.openById(properties.getProperty(FEEDBACK_PROPERTY_KEYS.formId));
    const nameItem = form.getItemById(Number(properties.getProperty(FEEDBACK_PROPERTY_KEYS.nameItemId))).asTextItem();
    const subjectItem = form.getItemById(Number(properties.getProperty(FEEDBACK_PROPERTY_KEYS.subjectItemId))).asTextItem();
    const messageItem = form.getItemById(Number(properties.getProperty(FEEDBACK_PROPERTY_KEYS.messageItemId))).asParagraphTextItem();

    form.createResponse()
      .withItemResponse(nameItem.createResponse(name))
      .withItemResponse(subjectItem.createResponse(subject))
      .withItemResponse(messageItem.createResponse(message))
      .submit();

    return feedbackResponse_(true, requestId);
  } catch (error) {
    console.error('Feedback submission failed: ' + error.message);
    return feedbackResponse_(false, requestId);
  }
}

function sendFeedbackNotification(event) {
  const properties = PropertiesService.getScriptProperties();
  const recipient = properties.getProperty(FEEDBACK_PROPERTY_KEYS.notificationEmail);
  if (!recipient) throw new Error('Feedback notification email is not configured.');

  const responses = event.response.getItemResponses();
  const values = {};
  responses.forEach(itemResponse => {
    const response = itemResponse.getResponse();
    values[itemResponse.getItem().getTitle()] = Array.isArray(response) ? response.join(', ') : String(response || '');
  });

  const subject = values.Subject || 'New feedback';
  const body = [
    'A new PlanetMusic feedback message was submitted.',
    '',
    'Name: ' + (values.Name || 'Anonymous'),
    'Subject: ' + subject,
    '',
    'Message:',
    values.Message || ''
  ].join('\n');

  MailApp.sendEmail(recipient, 'PlanetMusic feedback: ' + subject, body);
}

function feedbackResponse_(success, requestId) {
  const payload = JSON.stringify({
    type: 'planetmusic-feedback-result',
    success: success,
    requestId: requestId
  }).replace(/</g, '\\u003c');

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>window.top.postMessage(' + payload + ', "*");</script></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}