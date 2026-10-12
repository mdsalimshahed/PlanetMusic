import SettingSlider from './SettingSlider.jsx';
import SettingToggle from './SettingToggle.jsx';
import SettingsCardHeading from './SettingsCardHeading.jsx';
import SettingsSubheading from './SettingsSubheading.jsx';

const GroupChatSettings = ({ settings, handleChange, getSliderStyle }) => (
  <div className="settings-card glass-panel">
    <SettingsCardHeading seed="group-chat">Group Chat Settings</SettingsCardHeading>
    <SettingsSubheading seed="group-chat-heading">Heading Avatars</SettingsSubheading>
    <SettingSlider
      label="Active Artist Avatar Size"
      description="Sets the size of active heading avatars relative to the viewport height."
      name="groupChatActiveAvatarSize"
      value={settings.groupChatActiveAvatarSize ?? 5}
      min={2}
      max={9}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Inactive Artist Avatar Size"
      description="Sets the size of inactive heading avatars relative to the viewport height."
      name="groupChatInactiveAvatarSize"
      value={settings.groupChatInactiveAvatarSize ?? 3.5}
      min={1.5}
      max={7}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <div className="group-divider" />
    <SettingsSubheading seed="group-chat-messages">Messages & Notifications</SettingsSubheading>
    <SettingSlider
      label="Chat Bubble Avatar Size"
      description="Sets the size of bubble avatars relative to the viewport height."
      name="groupChatBubbleAvatarSize"
      value={settings.groupChatBubbleAvatarSize ?? 4.25}
      min={2}
      max={9}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Chat Bubble Lyric Font Size"
      description="Sets lyric text size relative to the viewport height."
      name="groupChatLyricFontSize"
      value={settings.groupChatLyricFontSize ?? 2.2}
      min={1}
      max={4}
      step={0.1}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Line Wrap Width"
      description="Wraps lyric lines when they exceed this percentage of the Group Chat canvas width."
      name="groupChatLineWrapWidth"
      value={settings.groupChatLineWrapWidth ?? 60}
      min={10}
      max={100}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <div className="group-divider" />
    <SettingsSubheading seed="group-chat-typing">Typing Indicator</SettingsSubheading>
    <SettingSlider
      label="Typing Indicator Text Size"
      description="Sets typing-indicator text size relative to the viewport height."
      name="groupChatTypingFontSize"
      value={settings.groupChatTypingFontSize ?? 1.1}
      min={0.7}
      max={3.5}
      step={0.1}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Typing Indicator Avatar Size"
      description="Sets typing-indicator avatar size relative to the viewport height. The footer grows to fit."
      name="groupChatTypingAvatarSize"
      value={settings.groupChatTypingAvatarSize ?? 2.4}
      min={1.2}
      max={8}
      step={0.1}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Artist Name Size"
      description="Sets artist-name text size relative to the viewport height."
      name="groupChatArtistNameSize"
      value={settings.groupChatArtistNameSize ?? 1.25}
      min={0.7}
      max={3}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Timestamp Size"
      description="Sets timestamp text size relative to the viewport height."
      name="groupChatTimestampSize"
      value={settings.groupChatTimestampSize ?? 1.125}
      min={0.6}
      max={2.5}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Notification Size"
      description="Sets notification text size relative to the viewport height."
      name="groupChatNotificationSize"
      value={settings.groupChatNotificationSize ?? 1.375}
      min={0.7}
      max={3}
      step={0.025}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <div className="group-divider" />
    <SettingsSubheading seed="group-chat-avatar-ring">Avatar Ring</SettingsSubheading>
    <SettingToggle
      label="Show Artist Color Ring"
      description="Show a colored ring around Group Chat avatars."
      name="groupChatAvatarRingEnabled"
      checked={settings.groupChatAvatarRingEnabled !== false}
      handleChange={handleChange}
    />
    <SettingSlider
      label="Color Ring Thickness"
      description="Sets ring thickness relative to the viewport height."
      name="groupChatAvatarRingThickness"
      value={settings.groupChatAvatarRingThickness ?? 0.12}
      min={0.05}
      max={0.5}
      step={0.01}
      unit="vh"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
  </div>
);

export default GroupChatSettings;
