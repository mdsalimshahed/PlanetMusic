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
      description="Sets the size of active heading avatars as a percentage of the canvas width."
      name="groupChatActiveAvatarSize"
      value={settings.groupChatActiveAvatarSize ?? 5}
      min={2}
      max={9}
      step={0.025}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Inactive Artist Avatar Size"
      description="Sets the size of inactive heading avatars as a percentage of the canvas width."
      name="groupChatInactiveAvatarSize"
      value={settings.groupChatInactiveAvatarSize ?? 3.5}
      min={1.5}
      max={7}
      step={0.025}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <div className="group-divider" />
    <SettingsSubheading seed="group-chat-messages">Messages & Notifications</SettingsSubheading>
    <SettingSlider
      label="Chat Bubble Avatar Size"
      description="Sets the size of bubble avatars as a percentage of the canvas width."
      name="groupChatBubbleAvatarSize"
      value={settings.groupChatBubbleAvatarSize ?? 4.25}
      min={2}
      max={9}
      step={0.025}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Artist Name Size"
      description="Sets artist-name text size as a percentage of the canvas width."
      name="groupChatArtistNameSize"
      value={settings.groupChatArtistNameSize ?? 1.25}
      min={0.7}
      max={3}
      step={0.025}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Timestamp Size"
      description="Sets timestamp text size as a percentage of the canvas width."
      name="groupChatTimestampSize"
      value={settings.groupChatTimestampSize ?? 1.125}
      min={0.6}
      max={2.5}
      step={0.025}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
    <SettingSlider
      label="Notification Size"
      description="Sets notification text size as a percentage of the canvas width."
      name="groupChatNotificationSize"
      value={settings.groupChatNotificationSize ?? 1.375}
      min={0.7}
      max={3}
      step={0.025}
      unit="%"
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
      description="Sets ring thickness relative to the Group Chat canvas width."
      name="groupChatAvatarRingThickness"
      value={settings.groupChatAvatarRingThickness ?? 0.12}
      min={0.05}
      max={0.5}
      step={0.01}
      unit="%"
      handleChange={handleChange}
      getSliderStyle={getSliderStyle}
    />
  </div>
);

export default GroupChatSettings;
