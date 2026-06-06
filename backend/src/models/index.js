module.exports = {
  ...require('./user.model'),
  ...require('./conversation.model'),
  ...require('./channel.model'),
  ...require('./message.model'),
  ...require('./call.model'),
  ...require('./storage.model'),
};
