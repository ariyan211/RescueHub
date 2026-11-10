import type {
  Activity,
  Category,
  IncidentRecord,
  IncidentStatus,
  SafetyAnswer,
  Severity,
  Verification,
} from "../types/incident";
import { suggestSeverity } from "../utils/severity";

const records: Array<{
  title: string;
  category: Category;
  location: string;
  severity: Severity;
  status: IncidentStatus;
  verification: Verification;
  hoursAgo: number;
  people: number;
  immediate: SafetyAnswer;
  trapped: SafetyAnswer;
  ongoing: SafetyAnswer;
}> = [
  {
    title: "Smoke in apartment stairwell",
    category: "Fire",
    location: "14 Cedar Lane, Northpoint",
    severity: "Critical",
    status: "In Progress",
    verification: "Verified",
    hoursAgo: 3,
    people: 12,
    immediate: "Yes",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Two-car intersection collision",
    category: "Road Accident",
    location: "West Avenue & 8th Street",
    severity: "High",
    status: "Pending",
    verification: "Under Review",
    hoursAgo: 6,
    people: 3,
    immediate: "No",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Visitor feeling faint at library",
    category: "Medical Emergency",
    location: "Riverside Community Library",
    severity: "Medium",
    status: "Resolved",
    verification: "Verified",
    hoursAgo: 28,
    people: 1,
    immediate: "Unknown",
    trapped: "No",
    ongoing: "No",
  },
  {
    title: "Creek rising near footpath",
    category: "Flood",
    location: "Willow Creek Footpath",
    severity: "High",
    status: "In Progress",
    verification: "Verified",
    hoursAgo: 10,
    people: 0,
    immediate: "No",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Cracked awning over entrance",
    category: "Building Collapse",
    location: "Market Hall, South Entrance",
    severity: "Critical",
    status: "Reported",
    verification: "Unverified",
    hoursAgo: 1,
    people: 4,
    immediate: "No",
    trapped: "Yes",
    ongoing: "Unknown",
  },
  {
    title: "Downed tree blocking access",
    category: "Other Emergency",
    location: "Pineview Drive near Lot C",
    severity: "Low",
    status: "Pending",
    verification: "Under Review",
    hoursAgo: 18,
    people: 0,
    immediate: "No",
    trapped: "No",
    ongoing: "No",
  },
  {
    title: "Bin fire behind workshop",
    category: "Fire",
    location: "Eastfield Workshop District",
    severity: "High",
    status: "Resolved",
    verification: "Verified",
    hoursAgo: 52,
    people: 0,
    immediate: "No",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Cyclist injured on shared path",
    category: "Road Accident",
    location: "Greenway Mile 4",
    severity: "Medium",
    status: "In Progress",
    verification: "Under Review",
    hoursAgo: 14,
    people: 1,
    immediate: "Unknown",
    trapped: "No",
    ongoing: "No",
  },
  {
    title: "Breathing difficulty at sports hall",
    category: "Medical Emergency",
    location: "Lakeside Sports Hall",
    severity: "Critical",
    status: "Resolved",
    verification: "Verified",
    hoursAgo: 74,
    people: 1,
    immediate: "Yes",
    trapped: "No",
    ongoing: "No",
  },
  {
    title: "Water entering ground-floor shops",
    category: "Flood",
    location: "Old Mill Arcade",
    severity: "High",
    status: "Reported",
    verification: "Unverified",
    hoursAgo: 4,
    people: 8,
    immediate: "No",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Loose masonry after storm",
    category: "Building Collapse",
    location: "22 Beacon Row",
    severity: "Medium",
    status: "Pending",
    verification: "Under Review",
    hoursAgo: 32,
    people: 2,
    immediate: "Unknown",
    trapped: "No",
    ongoing: "Unknown",
  },
  {
    title: "Power line across service road",
    category: "Other Emergency",
    location: "Harbor Service Road",
    severity: "Critical",
    status: "In Progress",
    verification: "Verified",
    hoursAgo: 9,
    people: 0,
    immediate: "Yes",
    trapped: "No",
    ongoing: "Yes",
  },
  {
    title: "Small grass fire extinguished",
    category: "Fire",
    location: "Meadow Park East",
    severity: "Low",
    status: "Resolved",
    verification: "Verified",
    hoursAgo: 96,
    people: 0,
    immediate: "No",
    trapped: "No",
    ongoing: "No",
  },
];

// Fictional, approximate demo coordinates on a loose grid. They do not match the fictional place names.
export function seedCoordinates(index: number) {
  return {
    latitude: 40.7 + ((index * 3) % 7) * 0.007 + (index % 2) * 0.003,
    longitude: -74.02 + ((index * 5) % 9) * 0.008,
  };
}

export function createSeedIncidents(): IncidentRecord[] {
  return records.map((record, index) => {
    const createdAt = new Date(Date.now() - record.hoursAgo * 3_600_000).toISOString();
    const suggestion = suggestSeverity({
      immediateThreat: record.immediate,
      peopleTrapped: record.trapped,
      ongoingHazard: record.ongoing,
    });
    const activity: Activity[] = [
      {
        id: `seed-${index}-submitted`,
        type: "submitted",
        message: "Report submitted.",
        actor: "Reporter",
        timestamp: createdAt,
      },
      {
        id: `seed-${index}-severity`,
        type: "severity_suggested",
        message: `${suggestion.severity} severity suggested.`,
        actor: "System",
        timestamp: new Date(new Date(createdAt).getTime() + 60_000).toISOString(),
      },
    ];
    if (record.verification !== "Unverified")
      activity.push({
        id: `seed-${index}-verify`,
        type: "verification_changed",
        message: `Verification changed to ${record.verification}.`,
        actor: "Demo administrator",
        timestamp: new Date(new Date(createdAt).getTime() + 1_800_000).toISOString(),
      });
    if (record.status !== "Reported")
      activity.push({
        id: `seed-${index}-status`,
        type: "status_changed",
        message: `Status changed to ${record.status}.`,
        actor: "Demo administrator",
        timestamp: new Date(new Date(createdAt).getTime() + 3_600_000).toISOString(),
      });
    return {
      id: `demo-${String(index + 1).padStart(3, "0")}`,
      reference: `RH-DEMO-${String(4101 + index)}`,
      title: record.title,
      description: `Fictional demo report concerning ${record.title.toLowerCase()}. This entry contains no real personal information.`,
      category: record.category,
      locationText: record.location,
      peopleAffected: record.people,
      coordinates: seedCoordinates(index),
      immediateThreat: record.immediate,
      peopleTrapped: record.trapped,
      ongoingHazard: record.ongoing,
      suggestedSeverity: suggestion.severity,
      currentSeverity: record.severity,
      severityReason: suggestion.reason,
      requiresReview: true,
      status: record.status,
      verification: record.verification,
      createdAt,
      updatedAt: activity.at(-1)?.timestamp ?? createdAt,
      activity,
    };
  });
}
