const selfPromoItems = [
  {
    id: 'video-caption-creator',
    name: 'Video Caption Creator',
    url: 'https://videocaptioncreator.pages.dev',
    visual: 'captions',
    artworkSets: [
      ['chapters', 'subtitle', 'youtube'],
      ['chapters', 'bookmark', 'youtube'],
      ['youtube', 'chapters', 'timecode'],
      ['subtitle', 'timecode', 'edit'],
      ['bookmark', 'chapters', 'timecode'],
      ['youtube', 'chapters', 'subtitle'],
      ['chapters', 'bookmark', 'timecode'],
      ['chapters', 'timeline', 'youtube'],
      ['youtube', 'chapters', 'bookmark'],
      ['chapters', 'timecode', 'subtitle'],
      ['chapters', 'subtitle', 'bookmark'],
      ['bookmark', 'timecode', 'keyboard'],
      ['subtitle', 'timecode', 'edit'],
      ['chapters', 'bookmark', 'export'],
      ['subtitle', 'export', 'timecode'],
      ['keyboard', 'bookmark', 'timecode'],
      ['edit', 'subtitle', 'timecode'],
      ['autosave', 'export', 'edit'],
      ['youtube', 'subtitle', 'chapters'],
      ['bookmark', 'chapters', 'export'],
      ['timecode', 'subtitle', 'edit']
    ],
    accent: '#70e1fd',
    campaigns: [
      {
        topic: 'YOUTUBE CHAPTERS + CAPTIONS',
        headline: 'Give every video a clear path.',
        detail: 'Build YouTube chapters and put your spoken words on screen.',
        features: ['Divide videos into chapters', 'Help viewers jump to moments', 'Add readable video captions'],
        action: 'Create chapters & captions'
      },
      {
        topic: 'ORGANIZE LONG VIDEOS',
        headline: 'Make every section easy to find.',
        detail: 'Add YouTube chapters so viewers can move straight to the part they want.',
        features: ['Break a video into sections', 'Make key moments easy to find', 'Keep the full video navigable'],
        action: 'Add YouTube chapters'
      },
      {
        topic: 'CHAPTERS FOR YOUR NEXT UPLOAD',
        headline: 'Give viewers a video roadmap.',
        detail: 'Create chapter breaks that make a YouTube video simpler to navigate.',
        features: ['Structure long-form videos', 'Point viewers to key topics', 'Make replaying sections simple'],
        action: 'Plan your chapters'
      },
      {
        topic: 'CAPTIONS + VIDEO STRUCTURE',
        headline: 'Make videos easier to follow.',
        detail: 'Pair readable captions with chapters that guide viewers through the video.',
        features: ['Show spoken words on screen', 'Separate topics into chapters', 'Help viewers follow along'],
        action: 'Build a clearer video'
      },
      {
        topic: 'FIND THE MOMENT THAT MATTERS',
        headline: 'Turn video chapters into signposts.',
        detail: 'Mark the important sections so viewers can jump to the moment they need.',
        features: ['Label key sections', 'Make topics easy to revisit', 'Navigate without guesswork'],
        action: 'Structure your video'
      },
      {
        topic: 'YOUTUBE VIDEO WORKFLOW',
        headline: 'Chapters for the big picture. Captions for every line.',
        detail: 'Organize the video into sections and make the dialogue visible.',
        features: ['Create chaptered sections', 'Show viewers where to jump', 'Put spoken words on screen'],
        action: 'Explore the creator'
      },
      {
        topic: 'MAKE A LONG VIDEO NAVIGABLE',
        headline: 'Help viewers get to the good part.',
        detail: 'Use YouTube chapters to turn a long watch into easy-to-find sections.',
        features: ['Mark topic changes', 'Jump back to useful moments', 'Give every section a place'],
        action: 'Add video chapters'
      },
      {
        topic: 'FROM OPENING TO OUTRO',
        headline: 'Give the whole video a structure.',
        detail: 'Create clear chapter stops from the first section to the final moment.',
        features: ['Organize the full video', 'Make sections easy to revisit', 'Guide viewers through each topic'],
        action: 'Create video chapters'
      },
      {
        topic: 'A BETTER WAY TO BROWSE',
        headline: 'Let viewers choose where to start.',
        detail: 'YouTube chapters make the topics inside your video easier to scan.',
        features: ['Show the video’s sections', 'Jump directly to a topic', 'Make favorite moments easy to find'],
        action: 'Organize your video'
      },
      {
        topic: 'CHAPTERS THAT KEEP VIEWERS MOVING',
        headline: 'Turn one long video into clear stops.',
        detail: 'Create YouTube chapters that make each part easy to find and revisit.',
        features: ['Break content into sections', 'Navigate straight to a moment', 'Keep topics organized'],
        action: 'Start chaptering'
      },
      {
        topic: 'ONE VIDEO, TWO ANNOTATION MODES',
        headline: 'Mark chapters or write timed captions.',
        detail: 'Use a single timestamp for a bookmark, or start and end times for subtitles.',
        features: ['Bookmark mode for chapters', 'Subtitle mode for captions', 'Choose the right entry style'],
        action: 'Choose an annotation mode'
      },
      {
        topic: 'CHAPTER POINTS WHILE YOU WATCH',
        headline: 'Bookmark the moment you want to revisit.',
        detail: 'Add a bookmark at the current playback position, then use it as a chapter point or note.',
        features: ['Capture a timestamp', 'Write a description', 'Jump back with one click'],
        action: 'Mark a video moment'
      },
      {
        topic: 'CAPTIONS WITH REAL IN AND OUT POINTS',
        headline: 'Give every subtitle a start and an end.',
        detail: 'Create timed subtitle entries, adjust their boundaries, and keep each phrase tied to playback.',
        features: ['Set start time', 'Set end time', 'Preview the exact segment'],
        action: 'Build timed subtitles'
      },
      {
        topic: 'MAKE A CHAPTER LIST FROM YOUR VIDEO',
        headline: 'Turn timestamps into a YouTube-ready outline.',
        detail: 'Build bookmark entries for key sections, then generate formatted chapter text.',
        features: ['Add one point per section', 'Name each chapter', 'Generate chapter text', 'Copy the finished chapter list'],
        action: 'Draft a chapter list'
      },
      {
        topic: 'SUBTITLES, READY TO EXPORT',
        headline: 'Move from caption entries to an SRT file.',
        detail: 'Generate subtitle output from entries with start and end times, then copy or download it.',
        features: ['Create timed caption entries', 'Generate .srt content', 'Copy or download output'],
        action: 'Prepare subtitle output'
      },
      {
        topic: 'A SHORTCUT FOR THE MOMENT',
        headline: 'Press Insert to capture a timestamp.',
        detail: 'Add a bookmark or subtitle at the current time with the keyboard shortcut; playback pauses for the entry.',
        features: ['Use the Insert key', 'Capture the current time', 'Keep your hands on the workflow'],
        action: 'Try quick annotation'
      },
      {
        topic: 'EDIT WITHOUT LOSING YOUR PLACE',
        headline: 'Select an entry and refine its details.',
        detail: 'Adjust a bookmark or subtitle description while keeping the annotation connected to its timestamp.',
        features: ['Select an existing entry', 'Edit its text', 'Update timing when needed'],
        action: 'Refine an annotation'
      },
      {
        topic: 'YOUR VIDEO HAS ITS OWN NOTES',
        headline: 'Pick up where you left off.',
        detail: 'Annotations save automatically in this browser for each video ID.',
        features: ['Save as you work', 'Keep projects separated by video', 'Return to the same video later'],
        action: 'Continue a video project'
      },
      {
        topic: 'FROM YOUTUBE LINK TO WORKSPACE',
        headline: 'Paste a video URL and start marking it up.',
        detail: 'Load a video from a standard YouTube page link or short link, then annotate beside the player.',
        features: ['Accept common YouTube links', 'Work beside the embedded player', 'Add chapters or subtitles'],
        action: 'Open the annotation workspace'
      },
      {
        topic: 'CHAPTERS FOR THE MOMENTS THAT MATTER',
        headline: 'Give viewers more than a start button.',
        detail: 'Create named timestamp stops so viewers can move through a video by topic.',
        features: ['Name important sections', 'Add a timestamp for each', 'Generate a chapter outline'],
        action: 'Make a video roadmap'
      },
      {
        topic: 'PRECISE CAPTION TIMING',
        headline: 'Tune each line to the playback.',
        detail: 'Select a subtitle, adjust its start and end, and play the segment to check the timing.',
        features: ['Edit both time boundaries', 'Preview a single segment', 'Keep text aligned to speech'],
        action: 'Tune caption timing'
      }
    ]
  },
  {
    id: 'stream-tracker',
    name: 'Stream Tracker',
    url: 'https://stream-tracker.mdsalimshahed.workers.dev',
    visual: 'streams',
    artworkSets: [
      ['sessions', 'games', 'timeline'],
      ['stats', 'activity', 'hours'],
      ['games', 'library', 'sessions'],
      ['progress', 'completion', 'library'],
      ['activity', 'stats', 'timeline'],
      ['timeline', 'hours', 'games'],
      ['completion', 'progress', 'library'],
      ['games', 'timeline', 'progress'],
      ['stats', 'activity', 'hours'],
      ['sessions', 'games', 'hours'],
      ['timeline', 'games', 'sessions'],
      ['hours', 'stats', 'activity'],
      ['progress', 'games', 'completion'],
      ['sessions', 'games', 'hours'],
      ['activity', 'timeline', 'stats'],
      ['completion', 'library', 'progress'],
      ['hours', 'sessions', 'stats'],
      ['games', 'library', 'timeline'],
      ['stats', 'activity', 'hours']
    ],
    accent: '#c69cff',
    campaigns: [
      {
        topic: 'YOUR STREAM HISTORY',
        headline: 'Every stream, on the record.',
        detail: 'Log the game, date, and duration for each play session.',
        features: ['Build a history by game', 'Keep session hours together', 'Look back at every run'],
        action: 'Log a stream'
      },
      {
        topic: 'PLAYTIME, MADE VISIBLE',
        headline: 'See where your hours go.',
        detail: 'Turn logged play sessions into clear game-by-game stats.',
        features: ['Compare hours by game', 'Spot your playtime patterns', 'Explore visual graphs'],
        action: 'Explore your stats'
      },
      {
        topic: 'GAME-BY-GAME LOGGING',
        headline: 'Know what you played.',
        detail: 'Keep each streamed game and its sessions in one history.',
        features: ['Find sessions by game', 'Track time spent playing', 'Keep your runs organized'],
        action: 'Track your games'
      },
      {
        topic: 'FOLLOW YOUR PLAYTHROUGHS',
        headline: 'Follow a game from start to finish.',
        detail: 'Keep tabs on your runs as games move from ongoing to complete.',
        features: ['Mark game progress', 'Separate ongoing and finished runs', 'See your completed games'],
        action: 'Track a playthrough'
      },
      {
        topic: 'SEE YOUR STREAMING RHYTHM',
        headline: 'Find your streaming rhythm.',
        detail: 'Use activity graphs to see when and how often you stream.',
        features: ['Explore stream frequency', 'See playtime by day', 'Review your activity patterns'],
        action: 'View the graphs'
      },
      {
        topic: 'SESSIONS ADD UP',
        headline: 'Turn sessions into a bigger picture.',
        detail: 'Bring individual streams together into a useful game history.',
        features: ['See hours across sessions', 'Review games over time', 'Understand your play habits'],
        action: 'Build your history'
      },
      {
        topic: 'COMPLETION TRACKING',
        headline: 'Celebrate the games you finish.',
        detail: 'Keep completed games distinct from the ones still in progress.',
        features: ['Record game status', 'Keep finished runs visible', 'See what is still ongoing'],
        action: 'Check your progress'
      },
      {
        topic: 'A HOME FOR EVERY RUN',
        headline: 'Give every game a timeline.',
        detail: 'Group your streamed sessions under the game you were playing.',
        features: ['Connect sessions to games', 'Revisit a game’s history', 'Keep playthroughs together'],
        action: 'Organize your streams'
      },
      {
        topic: 'VISUAL PLAYTIME STATS',
        headline: 'Your gaming hours, in focus.',
        detail: 'Explore visual summaries of playtime, games, and stream activity.',
        features: ['Break down hours by game', 'Explore activity graphs', 'See your history at a glance'],
        action: 'See your stats'
      },
      {
        topic: 'FROM LIVE TO LOGGED',
        headline: 'Remember more than the game.',
        detail: 'Keep a record of what you streamed and how long each run lasted.',
        features: ['Log session duration', 'Keep a game-by-game record', 'Follow progress to completion'],
        action: 'Start tracking'
      },
      {
        topic: 'A TIMELINE FOR EACH GAME',
        headline: 'See each session in context.',
        detail: 'Keep sessions grouped with the game they belong to instead of scattered across a calendar.',
        features: ['Group sessions by game', 'Review the order you played', 'Return to a game history'],
        action: 'Browse game timelines'
      },
      {
        topic: 'COMPARE YOUR PLAYTIME',
        headline: 'Which game got the most hours?',
        detail: 'Use the graphs to compare logged time across the games you have been playing.',
        features: ['Compare totals by game', 'Spot your biggest time sinks', 'See the numbers visually'],
        action: 'Compare game hours'
      },
      {
        topic: 'PICK UP AN UNFINISHED RUN',
        headline: 'Keep ongoing games on your radar.',
        detail: 'Track which playthroughs are still active and separate them from finished games.',
        features: ['Mark current status', 'Find ongoing games quickly', 'Keep completed runs distinct'],
        action: 'Review your progress'
      },
      {
        topic: 'A RECORD OF WHAT YOU STREAMED',
        headline: 'Future you will remember the details.',
        detail: 'Log the game and session duration so your streaming history is easy to revisit.',
        features: ['Save the game for each run', 'Record session hours', 'Build a searchable history'],
        action: 'Start a session log'
      },
      {
        topic: 'HOW OFTEN DO YOU GO LIVE?',
        headline: 'Look for patterns in your sessions.',
        detail: 'Activity graphs make it easier to review your streaming frequency and playtime over time.',
        features: ['See activity by day', 'Review streaming frequency', 'Recognize your routine'],
        action: 'Explore activity'
      },
      {
        topic: 'FINISHED MEANS FINISHED',
        headline: 'Give completed games their own place.',
        detail: 'Mark a game complete and keep it separate from the playthroughs still in progress.',
        features: ['Set a completion status', 'Keep finished games visible', 'See what remains active'],
        action: 'Sort your playthroughs'
      },
      {
        topic: 'SESSION HOURS THAT ADD UP',
        headline: 'See the time behind every title.',
        detail: 'Review your recorded sessions as a bigger picture of where your game time goes.',
        features: ['Track session duration', 'Build per-game totals', 'Compare your history'],
        action: 'Review playtime'
      },
      {
        topic: 'YOUR STREAMING HISTORY, ORGANIZED',
        headline: 'Find the game behind every session.',
        detail: 'Keep game records and the sessions attached to them together in one tracker.',
        features: ['Keep sessions with their game', 'Revisit previous runs', 'Follow status over time'],
        action: 'Organize a game history'
      },
      {
        topic: 'GRAPHS THAT ANSWER “HOW MUCH?”',
        headline: 'Turn a session log into useful stats.',
        detail: 'Visualize playtime and streaming activity instead of relying on memory.',
        features: ['See totals as graphs', 'Compare titles at a glance', 'Review activity patterns'],
        action: 'See your playtime'
      }
    ]
  }
];

export default selfPromoItems;
