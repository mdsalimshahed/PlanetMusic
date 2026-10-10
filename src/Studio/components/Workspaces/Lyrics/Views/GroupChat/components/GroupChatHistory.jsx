import GroupChatMessageChain from './GroupChatMessageChain.jsx';
import { getClockTime } from '../utils/groupChatUtils.js';

const GroupChatHistory = ({
  history,
  playbackTime,
  messageProps
}) => (
  <div className="group-chat-history-content">
    {history.map((item, itemIndex) => {
      if (item.type !== 'message-chain') {
        const { event } = item;
        return (
          <div
            className="group-chat-system-message"
            key={`${item.type}-${event.artist.name}-${event.time}-${itemIndex}`}
            role="status"
          >
            <span>{event.artist.name} {item.type === 'join' ? 'joined the chat' : 'left the chat'}</span>
            <time>{getClockTime(event.time, playbackTime)}</time>
          </div>
        );
      }

      return (
        <GroupChatMessageChain
          {...messageProps}
          group={item}
          itemIndex={itemIndex}
          key={`chain-${item.events[0].line.index}-${itemIndex}`}
        />
      );
    })}
  </div>
);

export default GroupChatHistory;
