## FlowMouse Changelog

### v2.3 (Unreleased)

**New Features:**

- **Context-aware search menus:** Custom mouse menus can now contain search-engine entries from a built-in catalog (displayed with icons) alongside custom search/link items; menus carry site patterns so the same gesture automatically opens the right menu per site (contextual mode); a new "Add current site to menu" gesture appends `*hostname*` to a menu's patterns, making it quick to assign a menu to the site you're currently visiting.
  - **Editable Search Engines section:** The options page now has a top-level "Search Engines" section where you can add, edit, hide, reorder, and reset both built-in and custom search engines.
  - **Clipboard-open mode:** A new per-engine option copies the selected text to the clipboard and opens the page without a query parameter — useful for services like Gemini that do not accept a `?q=` URL.
  - **Custom JavaScript transform for search links:** Each search-link engine can now carry an optional JS snippet that receives the current `selection` (and optionally the `clipboard`) and returns the string substituted for `%s`. The snippet runs in an isolated sandbox with no access to the page or the extension, and can be tested against a sample input directly in the editor. An optional **"Replace default encoding"** toggle inserts the transform result verbatim into the URL, skipping `%s`, `+`, and slug encoding — useful when the function already returns a fully-formed URL component.
- Search-engine selection for text drag and the clipboard-search action now uses the central search-engine catalog, so your custom engines, hidden state, and ordering apply there too. Regional search engines (Baidu, Yandex, Naver, etc.) are included but hidden by default.
- Image search engines are now configurable in the "Search engines" page (Text/Image switch) — add custom reverse-image engines, reorder, hide, and give each an optional image-URL transform (e.g. thumbnail → original).

### v2.2 (2026-06-29)

**New Features:**
- New gestures:
  - **Switch to Last Active Tab**
  - **Paste Custom Text**
  - URL Level Up
  - URL to Root
  - Invoke Another Extension
- Support opening in an Incognito/Private window for some gesture actions

**Interface & General Improvements:**
- Optimize performance when drawing gestures using custom CSS
- Other minor improvements


### v2.1 (2026-06-01)

**New Features:**
- Advanced Settings: Suppress drag gesture over input fields (Thanks to @xymoryn)
- New gesture action: Stop loading all tabs
- Support preserve tabs when closing other tabs (unload page content)
- Support opening pages in a new window

**Interface & General Improvements:**
- Auto theme mode now supports real-time switching with system theme (Thanks to @xymoryn)
- Fixed an issue in Zen browser where tab position might be incorrect when switching tabs
- Fixed an issue where the context menu might fail when gesture drawing is interrupted inside an iframe
- Fixed an issue where gesture trails might disappear when drawing gestures after refreshing certain pages
- Other minor improvements


### v2.0.3 (2026-05-07)

**New Features:**
- Gesture Prompts

**Interface & General Improvements:**
- Renamed advanced settings for clarity
- Other minor improvements


### v2.0.2 (2026-04-23)

- Fixed incorrect time display in the recently closed tabs popup menu on Firefox
- Fixed compatibility with Firefox 151+ beta versions
- Other minor improvements


### v2.0.1 (2026-04-22)

- Add Bookmark supports specifying a bookmark folder
- Avoid adding duplicate bookmarks for the same page
- Fixed an issue where the "Delay" command would disappear in command chain settings
- Fixed an issue that might affect using combinations like Control + Left Click to open the context menu on systems like macOS
- Improved area selection details and optimized compatibility within iframes


### v2.0 (2026-04-21)

**New Features:**
- **Area Select: Quickly select links on the page for batch operations**
- **Expert Mode: Custom CSS**
- Expert Mode: Customize HUD display names for gesture and drag actions
- **Redesigned the action settings window, simplify adding command chains**
- New gestures:
  - **Popup Menu**
    - Switch Tab
    - Show Recently Closed Tabs
    - Show Bookmarks
    - **Custom Menu**
  - **Zoom In / Zoom Out / Reset Zoom**
  - Copy Page Title and URL (Markdown optional)
  - Pause Gestures Until Refresh
  - Move Tab to New Window
  - Paste Clipboard
  - Search Clipboard
  - View Page Source
  - Save as MHTML
- New drag-and-drop actions:
  - Expert Mode: Send Custom Events
  - Link Dragging: Copy text and link (Markdown optional)
- **New mouse wheel gestures: Hold right-click and click the scroll wheel**
- Include gesture start points and additional data when sending custom events

**Gesture Improvements:**
- Left-click to cancel a gesture while drawing
- Custom URL supports placeholders (insert current page title and URL optionally)
- Improved scroll action logic to prioritize scrolling the element under the mouse

**Drag & Drop Improvements:**
- Improved HUD visuals when image dragging prioritizes opening links
- More features displayed by default outside of Expert Mode
- Fixed missing text when dragging from a Shadow DOM
- Expert Mode: Option to disable drag-and-drop inside input fields
- Fixed link dragging failing to trigger actions on certain pages
- Disable drag-and-drop on some pages that rely on drag-and-drop functionality to avoid interference

**Wheel Gesture Improvements:**
- Prevented the right-click menu from occasionally appearing after a wheel gesture

**Interface & General Improvements:**
- Optimized event binding for broader webpage compatibility
- Fixed gestures failing to work inside certain iframes
- Fixed operation hints not visible when drawing gestures in fullscreen mode on some pages
- Added explanatory notes for various features in settings
- Remove injected UI after gesture execution to improve compatibility
- Refined the design details of UI controls in the settings interface
- Support using gestures immediately after install/update without page refresh
- Other minor improvements


### v1.4.2 (2026-03-31)

- Relaxed the minimum version requirement for Firefox
- Optimized HUD display logic to improve compatibility with rich text editors like KindEditor


### v1.4 (2026-03-22)

**Gesture Improvements:**
- **Expert Mode: Support setting gesture trigger keys**: Right / Middle / Side / Stylus Right buttons
- Support keeping pinned tabs when closing tabs
- Simplified gesture icon display
- Refresh tab command supports hard reload (bypass cache)
- Support specifying tab position when opening a new tab or custom link

**Drag & Drop Improvements:**
- Improved HUD display when dragging text triggers automatic link recognition
- Improved drag type recognition logic
- Fixed an issue in Firefox where dragging an image inside a Shadow DOM might be incorrectly recognized as a link
- Fixed an issue where drag-and-drop did not work on certain websites

**Interface & More Improvements:**
- On-demand event binding to optimize compatibility with older web pages
- Fixed a settings sidebar bug for RTL languages
- Fixed an issue where gesture trail rendering stuttered on certain pages
- Other minor improvements


### v1.3 (2026-03-17)

**New Features:**
- **Added support for Firefox and Edge browsers**
- **Added mouse wheel gestures: Hold right mouse button and scroll up/down**
- **Added special gestures: Hold right mouse button and left-click / Hold left mouse button and right-click**
- **Expert Mode: Added command chains, allowing multiple actions to be executed in a single gesture**
- Support displaying the option to disable/enable gestures in the right-click context menu
- New color picker, supporting adjustments for gesture text/line opacity, blur, disabling shadows, etc.
- Expert Mode: Support adjusting gesture turning tolerance settings
- Added new gestures:
  - **Simulate Keystrokes**
  - Send Custom Events (Thanks to @g9wp)
  - Switch to First Tab / Switch to Last Tab
  - Pin/Unpin Current Tab
  - Close Window
  - Copy Page Title along with Current URL

**Gesture Improvements:**
- Support adjusting scroll distance and animation for each scroll gesture individually
- Optimized continuous scroll animations; support setting continuous scroll acceleration
- Gestures for switching to the left/right/first/last tab can now be configured to move the current tab instead
- New gesture action selection interface
- Support adjusting settings for certain gesture commands individually

**Drag & Drop Improvements:**
- **Dragging in the same direction supports executing multiple actions, such as multi-engine reverse image search / multi-engine search, etc.**
- **Support for custom drag-and-drop gestures**
- **Support opening pages in an Incognito/Private window when dragging**
- Support dragging to copy link text

**Interface & More Improvements:**
- **Brand new Logo design (Thanks to @Ps出来的小赵)**
- **Refactored code significantly to optimize performance and fix bugs**
- **New settings interface design**
- **Redesigned gesture recording process**
- Improved the design of the extension button popup
- Added reset buttons for specific options in the settings interface
- Improved language selection menu design
- Fixed an issue on macOS/Linux where gestures might affect the web page's right-click context menu
- Fixed an issue in Chrome where right-clicking on Bing web pages might break links
- Improved support for some third-party Android browsers
- Other minor improvements


### v1.2 (2026-02-10)

**New Features:**
- **Interactive tutorial displayed upon first installation**
- **Improved localization, supporting 39 languages**
- **Added prompts for pages with restricted gestures (can be partially disabled in settings)**
- Added new gestures:
    - Mute/Unmute Current Tab
    - Mute/Unmute All Tabs
    - Close Tab (Keep Window)
    - Close Tabs to the Left
    - Close Browser
    - Refresh All Tabs
- Gesture recognition uses a dynamic threshold algorithm to reduce misinterpretation
- Gesture trails use a smoothing algorithm for better visual experience
- Support for using gestures and drag-and-drop within the FlowMouse settings page
- Support for using ESC to interrupt gestures and drag-and-drop

**Gesture Improvements:**
- **Improved gesture experience on websites using iframes**
- Advanced Settings: Support for using system (high-performance) scroll animation; support for disabling animation
- Advanced Settings: Support adjusting gesture recognition trigger distance
- Fixed issue where scrolling gestures did not work on some websites
- Support searching with the browser's default search engine, and added more search engines

**Drag & Drop Improvements:**
- Optimized Super Drag: automatically cancel drag when the mouse leaves the window
- **Advanced Settings: Support prioritizing opening links when dragging text or images containing links**
- Advanced Settings: Support opening dragged targets in the current tab
- Fixed drag-and-drop issues on websites like Bilibili
- Fixed dragging of relative URL paths
- Fixed issue where drag-to-copy gestures failed on HTTP protocol pages
- Adapted for press-and-drag on touch screens and stylus pens

**Interface & More Improvements:**
- **New interface design for settings page; adjusted feature layout**
- **Clearer gesture arrow design**
- Optimized settings sync; supports syncing more settings (using "Export Configuration" is recommended for local backups)
- Reduced default permission requests; request permissions on demand when selecting "Save Image" or "Add Bookmark" gestures
- Fixed layout and font errors in gesture hint boxes on some websites
- Gesture hint boxes now use Shadow DOM to avoid interference from website styles
- Improved support for RTL languages
- Refactored code significantly to optimize performance and fix bugs
- Other minor improvements


### v1.1 (2025-12-24)

**Fixes & Optimizations:**
- **System Compatibility**: **Fixed right-click menu conflict on Mac and Linux; changed to double-click to call out the context menu to ensure mouse gestures work**.
    > Note: Due to macOS system characteristics, when dragging text, you must select the text, hold the left button briefly, and then drag; otherwise, the search may not trigger.
- **Default Experience Optimization**:
    - **Re-adjusted default gesture mapping to align with Edge browser, reducing the learning curve**.
    - New tab opening position changed from "Far Right" to **Right of Current Tab**.
    - Removed smooth scrolling animation for "Scroll to Top/Bottom" to significantly improve response speed.
- **Bug Fixes**:
    - Fixed issue where `localhost` domains could not be added to the blacklist.
    - Fixed issue where dragging left accidentally triggered "Create Split View," causing functionality failure.
- **Recognition Optimization**: Optimized gesture matching rules; gestures must strictly match the trajectory to respond, effectively preventing false positives.
- **Other**: Multiple detail experience optimizations.

**New Features:**
- **Global Switch**: Added a global "Enable/Disable" switch for **Mouse Gestures** (Super Drag is unaffected).
- **More Gesture Actions**: Added "Maximize/Restore Window", "Minimize Window", "Open Custom URL", "Copy Current URL", and other practical operations.
- **Advanced Settings** (Built for power users):
    - **Custom Scrolling**: Supports customizing scroll distance for "Scroll Up/Down" gestures.
    - **Visual Tweaks**: Supports enabling/disabling the display of the gesture trail origin point.
    - **Custom Gestures**: Supports drawing and adding custom mouse gestures (default supports 4-way combinations ↑↓←→).
    - **Super Drag Enhancements**:
        - Fully supports 4-way (↑↓←→) dragging and foreground/background opening settings for text, images, and links.
        - **Text**: Added "Copy Text".
        - **Images**: Added "Save Image", "Copy Image Address", "Custom Image Search".
        - **Links**: Added "Copy Link".