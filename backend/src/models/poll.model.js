// Builds the poll payload embedded into a message response.
// `myVotes` are the option ids the requesting user voted for.
function toPollResponse(poll, options = [], myVotes = []) {
  if (!poll) return null;
  const totalVotes = options.reduce((sum, o) => sum + (parseInt(o.vote_count, 10) || 0), 0);
  return {
    id: poll.id,
    message_id: poll.message_id,
    question: poll.question,
    is_anonymous: poll.is_anonymous,
    is_multiple: poll.is_multiple,
    closes_at: poll.closes_at,
    is_closed: poll.is_closed,
    total_votes: totalVotes,
    has_voted: myVotes.length > 0,
    options: options.map((o) => ({
      id: o.id,
      text: o.text,
      vote_count: parseInt(o.vote_count, 10) || 0,
      voted: myVotes.includes(o.id),
    })),
  };
}

module.exports = { toPollResponse };
