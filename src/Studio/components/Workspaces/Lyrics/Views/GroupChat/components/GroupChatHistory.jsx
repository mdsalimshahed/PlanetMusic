import GroupChatMessageChain from './GroupChatMessageChain.jsx';
import { getClockTime } from '../utils/groupChatUtils.js';

const GroupChatHistory = ({
  history,
  playbackTime,
  messageProps,
  precomputedLayouts,
}) => {
  return (
    <div className="group-chat-history-content">
      {history.map((item, itemIndex) => {
        if (item.type !== 'message-chain') {
          const { event } = item;
          return (
            <div
              className="group-chat-history-item"
              key={`${item.type}-${event.artist.name}-${event.time}`}
              data-history-item-id={`${item.type}-${event.artist.name}-${event.time}`}
            >
              <div className="group-chat-system-message" role="status">
                <span>{event.artist.name} {item.type === 'join' ? 'joined the chat' : 'left the chat'}</span>
                <time>{getClockTime(event.time, playbackTime)}</time>
              </div>
            </div>
          );
        }

        const id = `chain-${item.events[0].line.index}`;
        return (
          <div
            className="group-chat-history-item"
            key={id}
            data-history-item-id={id}
          >
            <GroupChatMessageChain
              {...messageProps}
              group={item}
              itemIndex={itemIndex}
              precomputedLayouts={precomputedLayouts}
            />
          </div>
        );
      })}
    </div>
  );
};

export default GroupChatHistory;
