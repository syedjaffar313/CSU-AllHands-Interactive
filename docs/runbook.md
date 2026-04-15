# Event Day Runbook – Operator SOP

## Pre-Event Checklist (1 hour before)

### Devices & Network
- [ ] **Operator laptop** charged, plugged in, sleep/screen lock DISABLED
- [ ] **Projector** connected via HDMI/USB-C, resolution set to 1080p
- [ ] **Wi-Fi** confirmed working; note SSID + password for audience
- [ ] **Backup hotspot** ready (phone tethering) in case Wi-Fi drops

### Browser Setup (Operator Laptop)
Open these tabs in Chrome/Edge (full screen capable):
1. **Tab 1: Control panel** → `https://<your-url>/control/CSU2026`
2. **Tab 2: Display view** → `https://<your-url>/display/CSU2026`
3. **Tab 3: PowerPoint** (web or desktop)

### System Prep
- [ ] Disable OS notifications (Focus Assist on Windows, Do Not Disturb on Mac)
- [ ] Disable browser notifications
- [ ] Close unnecessary apps (Teams, Outlook, Slack)
- [ ] Set display to "Extended" or "Duplicate" as needed

### Event Setup
1. In Control panel, click **"Load Templates"** to seed demo questions
2. Verify all templates appear (word cloud, poll, 2 quiz questions)
3. Create any custom questions needed for this event
4. Test ONE word cloud end-to-end with your phone

## During the Event

### Opening (Show QR Code)
1. Switch projector to **Display view** (Tab 2, press F11 for full screen)
2. The display shows "CSU All Hands – Waiting for next activity..."
3. **Switch projector back to PowerPoint** for the event intro
4. When ready, show the **join slide** with QR code + short URL
   - Or: in Control, the QR code is always visible
   - Audience scans once and stays connected

### Running an Interaction
1. On **Control panel** (Tab 1 on your screen, not projected):
   - Find the question → click **Launch**
2. Switch projector to **Display view** (Tab 2)
   - Results animate in real time
3. When done collecting → click **Close** in Control
4. For quiz: click **Reveal Answer** to show correct answer + leaderboard
5. Switch projector back to PowerPoint

### Flow Summary
```
PowerPoint → Display (launch question) → Collect → Close → Display results → PowerPoint
```

### Timing Recommendations
| Activity | Duration |
|----------|----------|
| Word Cloud | 30-60 seconds |
| Poll | 20-40 seconds |
| Quiz (per question) | 15-30 seconds (countdown timer helps) |

## Troubleshooting

### Display Not Updating
- Check the green dot (top right of Display view) — should be green
- If yellow (polling mode): SignalR dropped; still works, just 2s delay
- Refresh the Display tab

### Audience Can't Connect
- Verify Wi-Fi is working
- Try the direct URL instead of QR
- Check the event exists: `/api/events/CSU2026`

### SignalR Connection Lost
- The app automatically falls back to polling (2s interval)
- Refresh the page to attempt SignalR reconnect
- Check Azure SignalR Service health in portal

### Need to Reset
- In Control: you can re-launch a closed question
- Create new questions on the fly from Control

## Post-Event

1. **Export results**: In Control, click CSV/JSON export on each question
2. **Delete event** (if needed): Control → Delete Event
3. Events auto-expire based on retention setting (default 30 days)

## Emergency Contacts
- Azure Portal: https://portal.azure.com
- SWA dashboard: search "Static Web Apps" in portal
- SignalR dashboard: search "SignalR" in portal
