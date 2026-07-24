export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or Lucide name hint
  defaultTitle: string;
  defaultTags: string[];
  getContent: (todayStr: string) => string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'daily_journal',
    name: 'Daily Journal',
    description: 'Morning intentions, priority checklists, gratitude, and evening reflection.',
    icon: '🌅',
    defaultTitle: 'Daily Journal',
    defaultTags: ['journal', 'daily', 'reflection'],
    getContent: (todayStr) => `## 🌅 Morning Intentions (${todayStr})
- [ ] Top Priority 1: 
- [ ] Priority 2: 
- [ ] Priority 3: 

## 📝 Gratitude & Thoughts
- 

## ⚡ Energy & Focus Log
- Water: 💧💧💧
- Focus Level: ⚡⚡⚡

## 🌙 Evening Reflection
- **What went well today?** 
- **What could be improved tomorrow?** 
`
  },
  {
    id: 'project_plan',
    name: 'Project Plan',
    description: 'Roadmap overview, deliverables, team roles, and milestone checklists.',
    icon: '🚀',
    defaultTitle: 'Project Plan: ',
    defaultTags: ['project', 'roadmap', 'planning'],
    getContent: () => `# 🚀 Project Overview

## 🎯 Objectives & Key Results
- **Goal:** 
- **Target Completion Date:** 

## 📋 Deliverables & Milestones
- [ ] Phase 1: Requirements & Architecture
- [ ] Phase 2: Core Feature Implementation
- [ ] Phase 3: QA & Testing
- [ ] Phase 4: Production Deployment

## 👥 Roles & Responsibilities
| Role | Assignee | Status |
| --- | --- | --- |
| Tech Lead | | In Progress |
| Designer | | Pending |
| Reviewer | | Pending |

## ⚠️ Risks & Dependencies
- 
`
  },
  {
    id: 'meeting_notes',
    name: 'Meeting Notes',
    description: 'Structured agenda, attendees list, key decisions, and action items.',
    icon: '🤝',
    defaultTitle: 'Meeting Notes: ',
    defaultTags: ['meeting', 'discussion', 'notes'],
    getContent: (todayStr) => `# 🤝 Meeting Notes: [Topic]
**Date:** ${todayStr}  
**Attendees:** 

---

## 📌 Agenda
1. Topic 1
2. Topic 2

## 💡 Key Discussion Points
- 

## ✅ Action Items
- [ ] @owner - Task 1 (Due: )
- [ ] @owner - Task 2 (Due: )

## 📅 Next Steps
- 
`
  },
  {
    id: 'one_on_one',
    name: '1-on-1 Sync',
    description: 'Topics, wins, growth feedback, and alignment action items.',
    icon: '💬',
    defaultTitle: '1-on-1 Sync with ',
    defaultTags: ['1on1', 'sync', 'management'],
    getContent: (todayStr) => `# 💬 1-on-1 Sync
**Date:** ${todayStr}  
**Participant:** 

## 📋 Topics for Today
- [ ] Topic 1:
- [ ] Topic 2:

## 📈 Wins & Achievements
- 

## 💡 Feedback & Growth
- 

## ✅ Action Items
- [ ] Action item 1:
`
  },
  {
    id: 'incident_postmortem',
    name: 'Incident Post-Mortem',
    description: 'Root cause analysis, timeline, severity assessment, and preventative fixes.',
    icon: '🚨',
    defaultTitle: 'Incident Post-Mortem: ',
    defaultTags: ['incident', 'bug', 'postmortem'],
    getContent: (todayStr) => `# 🚨 Incident Post-Mortem: [Issue Name]
**Date:** ${todayStr}  
**Severity:** High / Medium / Low  

## 🔍 Incident Summary
Brief description of the outage or bug impact.

## ⏱️ Timeline
- **00:00** - Issue detected
- **00:15** - Mitigation initiated
- **00:30** - Root cause identified & patch deployed

## 🛠️ Root Cause Analysis
- 

## 🛡️ Preventative Action Items
- [ ] Fix root cause in codebase
- [ ] Add regression tests
- [ ] Update monitoring alerts
`
  },
  {
    id: 'code_review_notes',
    name: 'Code Architecture & RFC',
    description: 'Technical design document, trade-offs, API specs, and implementation steps.',
    icon: '📐',
    defaultTitle: 'RFC / Design Spec: ',
    defaultTags: ['architecture', 'rfc', 'engineering'],
    getContent: () => `# 📐 Technical Design / RFC: [Feature Name]

## 🎯 Context & Goals
Why are we building this?

## 🛠️ Proposed Solution
High-level architecture and design breakdown.

\`\`\`typescript
// Example interface
interface FeatureConfig {
  enabled: boolean;
}
\`\`\`

## ⚖️ Trade-offs & Alternatives
- **Option A:** 
- **Option B:** 

## ✅ Implementation Plan
- [ ] Step 1: Data model & API
- [ ] Step 2: UI integration
- [ ] Step 3: End-to-end testing
`
  }
];
