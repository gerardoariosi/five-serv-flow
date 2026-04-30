import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ArrowLeft, ArrowUp, ChevronDown, Search, HelpCircle, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

// =====================================================================
// Content
// =====================================================================

type DefItem = { label: string; description: string };
type Article = {
  id: string; // e.g. "1-1"
  number: string; // e.g. "1.1"
  title: string;
  kind: 'steps' | 'prose' | 'list';
  body: string[] | string | DefItem[];
  tip?: string;
  note?: string;
};
type Section = { id: string; number: number; title: string; articles: Article[] };

const HELP_SECTIONS: Section[] = [
  {
    id: 'getting-started',
    number: 1,
    title: 'Getting Started',
    articles: [
      {
        id: '1-1', number: '1.1', title: 'How to Log In', kind: 'steps',
        body: [
          'Open your browser and go to app.fiveserv.net',
          'Enter your email address in the Email field',
          'Enter your password in the Password field',
          'Click Sign In',
          'If Two-Factor Authentication is enabled, check your email for a verification code and enter it',
          'You will be taken to your Dashboard automatically',
        ],
        tip: 'If you forgot your password, click Forgot Password on the login screen.',
      },
      {
        id: '1-2', number: '1.2', title: 'How to Reset Your Password', kind: 'steps',
        body: [
          'On the login screen, click Forgot Password',
          'Enter your email address',
          'Check your email for a reset link',
          'Click the link in the email',
          'Enter your new password and confirm it',
          'Click Reset Password',
          'You can now log in with your new password',
        ],
      },
      {
        id: '1-3', number: '1.3', title: 'How to Set Up Your Profile', kind: 'steps',
        body: [
          'After logging in, click your avatar or initials in the top right corner',
          'Select Profile from the dropdown menu',
          'Update your name, email, and profile photo',
          'To change your password, scroll down to the Password section',
          'Enter your current and new password',
          'Click Save Changes',
        ],
      },
      {
        id: '1-4', number: '1.4', title: 'How to Enable Push Notifications', kind: 'steps',
        body: [
          'Log in to the app',
          'Go to Settings using the navigation menu',
          'Find the Notifications section',
          'Toggle Push Notifications to ON',
          'Your browser will ask for permission — click Allow',
          'You will now receive notifications even when the app is closed',
        ],
        note: 'On iPhone, open the app in Safari, tap the Share button, select Add to Home Screen. Then open the app from your home screen and enable notifications from Settings.',
      },
    ],
  },
  {
    id: 'tickets',
    number: 2,
    title: 'Tickets',
    articles: [
      {
        id: '2-1', number: '2.1', title: 'What is a Ticket?', kind: 'prose',
        body: 'A ticket is a work order — a job that needs to be done at a property. Every repair, maintenance task, make-ready, emergency, or large project starts as a ticket in FiveServ. Tickets track the entire life of a job from creation to completion and billing.',
      },
      {
        id: '2-2', number: '2.2', title: 'Understanding Ticket Types', kind: 'list',
        body: [
          { label: 'Make-Ready', description: 'Preparing a vacant unit for a new tenant. Includes painting, cleaning, repairs, and final walkthrough. Always comes from an approved inspection.' },
          { label: 'Repair', description: 'A specific repair needed at a property. Could be a leaking pipe, broken appliance, damaged wall, etc.' },
          { label: 'Emergency', description: 'Urgent work that needs immediate attention. Same process as Repair but marked as high priority.' },
          { label: 'CapEx', description: 'Large-scale capital expenditure project. Major renovations or large property improvements. Always requires a formal estimate before work begins.' },
        ] as DefItem[],
      },
      {
        id: '2-3', number: '2.3', title: 'Understanding Ticket Statuses', kind: 'list',
        body: [
          { label: 'Draft', description: 'Saved but not yet submitted' },
          { label: 'Open', description: 'Created and assigned, waiting for technician to start' },
          { label: 'On My Way', description: 'Technician is heading to the property' },
          { label: 'Arrived', description: 'Technician has arrived at the property' },
          { label: 'Pending Evaluation', description: 'Technician submitted evaluation, waiting for Admin decision' },
          { label: 'In Progress', description: 'Technician is actively working' },
          { label: 'Needs Estimate', description: 'Requires a formal estimate before proceeding' },
          { label: 'Estimate Sent', description: 'Estimate sent to PM, waiting for approval' },
          { label: 'Estimate Approved', description: 'PM approved, ready to reschedule' },
          { label: 'Paused', description: 'Work temporarily stopped' },
          { label: 'Ready for Review', description: 'Technician marked complete, waiting for Admin review' },
          { label: 'Closed', description: 'Job complete and approved' },
          { label: 'Rejected', description: 'Admin found issues and sent back for corrections' },
          { label: 'Cancelled', description: 'Ticket was cancelled' },
        ] as DefItem[],
      },
      {
        id: '2-4', number: '2.4', title: 'How to Create a Ticket (Admin/Supervisor only)', kind: 'steps',
        body: [
          'From Dashboard or Tickets page, click the + button or New Ticket',
          'Select Work Type: Make-Ready, Repair, Emergency, or CapEx',
          'Select Priority: Normal, Urgent, or Emergency',
          'Select the Client/PM from the dropdown',
          'Select the Property',
          'Enter the Unit number',
          'Select the Technician to assign the job',
          'Set the Appointment Date and Time (optional)',
          'Add a Description of the work needed',
          'Click Create Ticket',
        ],
        note: 'The technician automatically receives an email and push notification with the job details. You can also use the Quick Ticket button (gold + floating button on Dashboard) to create a ticket faster.',
      },
      {
        id: '2-5', number: '2.5', title: 'How to View and Search Tickets', kind: 'steps',
        body: [
          'Click Tickets in the navigation menu',
          'Use the search bar to find by FS number, property, PM, technician, or description',
          'Use filter chips (All, Unassigned, Emergencies, Make-Ready, High Priority) to narrow results',
          'Click any ticket to open its details',
        ],
      },
      {
        id: '2-6', number: '2.6', title: 'How to Assign or Reassign a Technician', kind: 'steps',
        body: [
          'Open the ticket',
          'Find the Technician field',
          'Click and select a different technician',
          'Save the change',
          'The new technician receives an email and push notification automatically',
        ],
      },
      {
        id: '2-7', number: '2.7', title: 'How to Approve a Ticket (Admin/Supervisor only)', kind: 'steps',
        body: [
          'You will receive a notification when a ticket is Ready for Review',
          'Open the ticket',
          'Review photos, timeline, and technician notes',
          'If everything looks correct, click Approve',
          'Status changes to Closed',
          'Accounting team receives a notification to process the invoice',
        ],
      },
      {
        id: '2-8', number: '2.8', title: 'How to Reject a Ticket (Admin/Supervisor only)', kind: 'steps',
        body: [
          'Open the ticket in Ready for Review status',
          'Review the work photos and notes',
          'Click Reject',
          'Enter a clear reason explaining what needs to be fixed',
          'Click Confirm Reject',
          'Technician receives a notification with the rejection reason and must fix and resubmit',
        ],
      },
      {
        id: '2-9', number: '2.9', title: 'How the Estimate Flow Works', kind: 'steps',
        body: [
          'Technician arrives and taps Arrived',
          'Technician fills out the Evaluation form — describes what they found and uploads photos',
          'Technician taps Submit Evaluation — Admin receives a notification',
          'If the work is straightforward, Admin clicks Approve to Work — technician receives a notification and starts working',
          'If a quote is required, Admin clicks Estimate Required',
          'Admin creates an estimate inside the ticket with a problem description and up to 3 solution options with prices',
          'Admin clicks Send Estimate to PM',
          'PM receives an email with a secure link to review the options (the same secure-portal mechanism used by the Inspection PM Portal)',
          'PM selects an option, signs digitally, and submits',
          'Admin receives a notification of approval',
          'Admin reschedules and assigns a technician',
          'Technician receives a notification with the new appointment and the work continues to completion',
        ],
      },
      {
        id: '2-10', number: '2.10', title: 'How to Duplicate a Ticket', kind: 'steps',
        body: [
          'Open a closed ticket',
          'Click the Duplicate button',
          'A new ticket is created with the same property, unit, work type, and technician',
          'Edit any fields that need to change',
          'Click Create Ticket',
        ],
      },
    ],
  },
  {
    id: 'inspections',
    number: 3,
    title: 'Inspections',
    articles: [
      {
        id: '3-1', number: '3.1', title: 'What is an Inspection?', kind: 'prose',
        body: 'An inspection is a formal property walkthrough where a technician evaluates the condition of a unit and creates an itemized list of repairs needed with pricing. The inspection is sent to the Property Manager for approval. Once approved, it automatically creates a Make-Ready ticket.',
      },
      {
        id: '3-2', number: '3.2', title: 'How to Create an Inspection', kind: 'steps',
        body: [
          'Click Inspections in the navigation menu',
          'Click New Inspection',
          'Select the Client/PM',
          'Select the Property',
          'Enter the Unit number',
          'Set the Visit Date',
          'Enter the unit configuration (bedrooms, bathrooms, living rooms)',
          'Click Create Inspection',
          'You will be taken to the inspection form to add items by area',
        ],
      },
      {
        id: '3-3', number: '3.3', title: 'How to Add Inspection Items', kind: 'steps',
        body: [
          'Inside the inspection, you will see areas (Kitchen, Bathroom, Bedroom, etc.)',
          'For each item, tap to mark its condition: Good, Needs Repair, or Urgent',
          'Enter the quantity and unit price',
          'Add a note if needed (example: Water damage on left wall)',
          'Upload photos for that item',
          'Add custom items by tapping Add Custom Item',
          'Continue through all areas until complete',
        ],
      },
      {
        id: '3-4', number: '3.4', title: 'How to Send an Inspection to the PM', kind: 'steps',
        body: [
          'Complete all inspection items',
          'Review the Pricing Review tab to confirm all prices are correct',
          'Click Send to PM',
          'Confirm the PM email address',
          'Add an optional note for the PM',
          'Click Send',
          'PM receives an email with a secure link to review and approve',
        ],
      },
      {
        id: '3-5', number: '3.5', title: 'How the PM Inspection Portal Works (for Property Managers)', kind: 'steps',
        body: [
          'Open the FiveServ email and click Review and Approve Inspection',
          'Enter the PIN provided by FiveServ',
          'Review each item in the inspection',
          'Check the box next to each item you approve',
          'Add optional notes per item',
          'Review the Selected Total at the bottom',
          'Add a General Note if needed',
          'Draw your digital signature',
          'Click Submit Response',
          'FiveServ receives your approval automatically',
        ],
        note: 'The Estimate Portal for ticket estimates uses the same secure PIN + digital signature flow.',
      },
      {
        id: '3-6', number: '3.6', title: 'How to Export an Inspection PDF', kind: 'steps',
        body: [
          'Open an inspection',
          'Click the Export PDF or download button',
          'Choose Internal Report or PM Version',
          'PDF downloads to your device',
        ],
      },
    ],
  },
  {
    id: 'technicians',
    number: 4,
    title: 'For Technicians',
    articles: [
      {
        id: '4-1', number: '4.1', title: 'How to View Your Assigned Tickets', kind: 'steps',
        body: [
          'Log in — your My Work page shows your assigned tickets automatically',
          'Tap any ticket to see full details including address, work type, and instructions',
          'Use My Calendar to see your schedule by day',
        ],
      },
      {
        id: '4-2', number: '4.2', title: 'How to Start a Job', kind: 'steps',
        body: [
          'Open your assigned ticket',
          'When leaving for the property, tap On My Way',
          'When you arrive, tap Arrived',
          'For Make-Ready tickets: tap Start Work and begin immediately',
          'For Repair, Emergency, or CapEx tickets: fill out the Evaluation form first',
        ],
      },
      {
        id: '4-3', number: '4.3', title: 'How to Submit an Evaluation', kind: 'steps',
        body: [
          'After tapping Arrived, the Evaluation form appears',
          'In "What did you find?" describe the problem clearly and specifically',
          'Upload photos of the issue from multiple angles',
          'Tap Submit to Admin',
          'You will see "Waiting for admin decision" — wait for the response before leaving',
        ],
      },
      {
        id: '4-4', number: '4.4', title: 'How to Pause a Job', kind: 'steps',
        body: [
          'While a job is In Progress, tap Pause',
          'Enter the reason for pausing (waiting for parts, no access, etc.)',
          'Enter the expected return date',
          'Tap Confirm Pause',
          'Admin will receive a notification',
        ],
      },
      {
        id: '4-5', number: '4.5', title: 'How to Mark a Job Complete', kind: 'steps',
        body: [
          'When work is finished, upload After photos showing the completed work clearly',
          'Add final notes for the Admin if needed',
          'Tap Ready for Review',
          'Admin will review and either approve or request corrections',
          'If rejected, read the reason carefully, fix the issues, and resubmit',
        ],
      },
      {
        id: '4-6', number: '4.6', title: 'How to Get Directions to a Property', kind: 'steps',
        body: [
          'Open your assigned ticket',
          'Tap the Get Directions button',
          'Google Maps opens automatically with the property address',
        ],
      },
    ],
  },
  {
    id: 'accounting',
    number: 5,
    title: 'Accounting',
    articles: [
      {
        id: '5-1', number: '5.1', title: 'How to View Billing Status', kind: 'steps',
        body: [
          'Click Accounting in the navigation menu',
          'See all closed tickets with billing status: Pending, Invoiced, or Paid',
          'Filter by status using the filter options',
        ],
      },
      {
        id: '5-2', number: '5.2', title: 'How to Mark a Ticket as Invoiced', kind: 'steps',
        body: [
          'Find the ticket in the Accounting list',
          'Open the ticket',
          'Click Mark as Invoiced',
          'Enter the QuickBooks Invoice Number',
          'Save the change',
        ],
      },
      {
        id: '5-3', number: '5.3', title: 'How to Update Multiple Tickets at Once (Bulk Update)', kind: 'steps',
        body: [
          'In the Accounting list, check the boxes next to multiple tickets',
          'A floating action bar appears at the bottom of the screen',
          'Click Mark as Invoiced or Mark as Paid',
          'All selected tickets update at once',
        ],
      },
      {
        id: '5-4', number: '5.4', title: 'How to View Billing Details', kind: 'steps',
        body: [
          'Open any ticket from the Accounting list',
          'See billing summary: work description, amounts, QB invoice number',
          'Add or edit accounting notes for internal reference',
        ],
      },
    ],
  },
  {
    id: 'team-settings',
    number: 6,
    title: 'Team and Settings',
    articles: [
      {
        id: '6-1', number: '6.1', title: 'How to Add a New User (Admin only)', kind: 'steps',
        body: [
          'Go to Settings in the navigation menu',
          'Click User Management',
          'Click Add User',
          "Enter the user's full name",
          'Enter their email address',
          'Select their role: Admin, Supervisor, Technician, or Accounting',
          'Click Create User',
          'User receives an email invitation to set their password and access the app',
        ],
        note: 'Only Admins can create and manage users. Technicians and Accounting cannot access this section.',
      },
      {
        id: '6-2', number: '6.2', title: 'Understanding User Roles', kind: 'list',
        body: [
          { label: 'Admin', description: 'Full access to everything. Can create tickets, inspections, and users. Can view all reports and financial information. Can approve work and manage all settings.' },
          { label: 'Supervisor', description: 'Similar to Admin but cannot manage users or access certain admin-only settings.' },
          { label: 'Technician', description: 'Can only see their assigned tickets and update job status. Cannot create tickets or see other technicians work.' },
          { label: 'Accounting', description: 'Can see closed tickets and billing information only. Cannot create or manage tickets.' },
        ] as DefItem[],
      },
      {
        id: '6-3', number: '6.3', title: 'How to Edit or Deactivate a User (Admin only)', kind: 'steps',
        body: [
          'Go to Settings → User Management',
          'Find the user in the list',
          'Click on their name',
          'Edit their name, email, or role as needed',
          'To deactivate, toggle the Active switch to OFF',
          'Save changes',
        ],
      },
      {
        id: '6-4', number: '6.4', title: 'How to Switch Between Roles (if you have multiple roles)', kind: 'steps',
        body: [
          'Open the navigation menu (hamburger icon top left)',
          'Use the Switch Role chips near the top of the menu',
          'Select the role you want to use',
          'Dashboard and features update automatically',
        ],
        note: 'You can also change your active role from your Profile page. The Switch Role chips only appear when your account has more than one role assigned.',
      },
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'I am not receiving push notifications. What should I do?', a: 'Go to Settings → Notifications and make sure Push Notifications is enabled. On iPhone, make sure you have added the app to your Home Screen first. Try toggling notifications off and back on.' },
  { q: 'I created a ticket but got an error. What happened?', a: 'Make sure all required fields are filled: Work Type, Priority, Property, and Unit are required. Refresh the page and try again if the error persists.' },
  { q: 'Can I edit a ticket after creating it?', a: 'Yes. Open the ticket and click the edit button. You can change the technician, appointment time, description, and priority before the ticket is closed.' },
  { q: 'What happens when a PM does not respond to an inspection?', a: 'The inspection link expires after 60 days. You can resend from the Inspection detail page by clicking Resend to PM.' },
  { q: 'Can I delete a ticket or inspection?', a: 'Tickets and inspections can be cancelled but not permanently deleted to maintain a complete record of all work.' },
  { q: 'How do I find an old ticket?', a: 'Go to Tickets and use the search bar. Search by FS number, property name, PM name, technician, or any keyword.' },
  { q: 'How do I report a problem with the app?', a: 'Contact your Admin directly. They can escalate technical issues to the FiveServ team.' },
];

// =====================================================================
// Helpers
// =====================================================================

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bodyToString(body: Article['body']): string {
  if (typeof body === 'string') return body;
  if (Array.isArray(body)) {
    return (body as Array<string | DefItem>)
      .map((b) => (typeof b === 'string' ? b : `${b.label} ${b.description}`))
      .join('\n');
  }
  return '';
}

// Flat searchable index, built once at module load.
type ArticleIndexEntry = {
  sectionId: string;
  articleId: string;
  title: string;
  body: string;
  tip: string;
  note: string;
};

const ARTICLE_INDEX: ArticleIndexEntry[] = HELP_SECTIONS.flatMap((s) =>
  s.articles.map((a) => ({
    sectionId: s.id,
    articleId: a.id,
    title: a.title,
    body: bodyToString(a.body),
    tip: a.tip ?? '',
    note: a.note ?? '',
  })),
);

// Synonym map — common alternate words/phrases users might search for.
const SYNONYMS: Record<string, string[]> = {
  ticket: ['work order', 'job', 'task', 'repair', 'create ticket'],
  inspection: ['inspect', 'walkthrough', 'property check'],
  login: ['sign in', 'log in', 'access', 'password'],
  password: ['login', 'sign in', 'forgot', 'reset'],
  pm: ['property manager', 'client', 'portal'],
  photo: ['picture', 'image', 'upload photo', 'before after'],
  notification: ['push', 'alert', 'notify'],
  assign: ['technician', 'allocate', 'send job'],
  approve: ['review', 'accept', 'sign off'],
  reject: ['deny', 'revision', 'send back'],
  estimate: ['quote', 'price', 'cost', 'approval'],
  billing: ['invoice', 'payment', 'accounting', 'paid'],
  role: ['admin', 'supervisor', 'technician', 'accounting', 'permission'],
  duplicate: ['copy', 'clone', 'repeat ticket'],
  pause: ['stop', 'hold', 'waiting'],
  emergency: ['urgent', 'asap', 'immediate'],
  capex: ['renovation', 'project', 'capital'],
};

// Common stop words to ignore when tokenizing the query.
const STOP_WORDS = new Set([
  'how', 'to', 'a', 'an', 'the', 'i', 'do', 'can', 'what', 'is', 'are',
  'my', 'in', 'on', 'at', 'for', 'of', 'and', 'or', 'did', 'does',
  'where', 'when', 'why', 'which', 'who',
]);

// Get meaningful tokens from a query: lowercase, no stop words, length >= 3.
function meaningfulTokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// Expand meaningful tokens with synonyms.
function expandTokens(tokens: string[]): string[] {
  const terms = new Set<string>();
  for (const w of tokens) {
    terms.add(w);
    const syns = SYNONYMS[w];
    if (syns) syns.forEach((s) => terms.add(s.toLowerCase()));
    for (const [key, list] of Object.entries(SYNONYMS)) {
      if (list.some((s) => s.toLowerCase() === w)) terms.add(key);
    }
  }
  return Array.from(terms);
}

function articleMatchesPhrase(entry: ArticleIndexEntry, phrase: string): boolean {
  const haystack = `${entry.title}\n${entry.body}\n${entry.tip}\n${entry.note}`.toLowerCase();
  return haystack.includes(phrase);
}

function articleMatchesAny(entry: ArticleIndexEntry, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = `${entry.title}\n${entry.body}\n${entry.tip}\n${entry.note}`.toLowerCase();
  return terms.some((t) => haystack.includes(t));
}

function faqMatchesPhrase(faq: { q: string; a: string }, phrase: string): boolean {
  const haystack = `${faq.q}\n${faq.a}`.toLowerCase();
  return haystack.includes(phrase);
}

function faqMatchesAny(faq: { q: string; a: string }, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = `${faq.q}\n${faq.a}`.toLowerCase();
  return terms.some((t) => haystack.includes(t));
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;

  // Highlight: full phrase + meaningful tokens (no stop words) + their synonyms.
  const tokens = meaningfulTokens(q);
  const expanded = expandTokens(tokens);
  const all = new Set<string>(expanded);
  all.add(q.toLowerCase());

  const list = Array.from(all)
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length); // longest first

  if (list.length === 0) return <>{text}</>;

  const re = new RegExp(`(${list.map(escapeRegExp).join('|')})`, 'ig');
  const parts = text.split(re);
  const matchSet = new Set(list.map((t) => t.toLowerCase()));

  return (
    <>
      {parts.map((p, i) =>
        matchSet.has(p.toLowerCase()) ? (
          <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// =====================================================================
// Page
// =====================================================================

const HelpCenter = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>(HELP_SECTIONS[0].id);
  const [showTop, setShowTop] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Search: try whole-phrase match first; fall back to meaningful tokens (+ synonyms).
  const q = query.trim();
  const { filteredSections, filteredFaqs } = useMemo(() => {
    if (q.length < 2) {
      return { filteredSections: HELP_SECTIONS, filteredFaqs: FAQS };
    }
    const phrase = q.toLowerCase();

    // 1. Whole-phrase match
    let matchedIds = new Set(
      ARTICLE_INDEX.filter((e) => articleMatchesPhrase(e, phrase)).map((e) => e.articleId),
    );
    let faqs = FAQS.filter((f) => faqMatchesPhrase(f, phrase));

    // 2. Fallback: meaningful tokens + synonyms
    if (matchedIds.size === 0 && faqs.length === 0) {
      const tokens = meaningfulTokens(q);
      const terms = expandTokens(tokens);
      matchedIds = new Set(
        ARTICLE_INDEX.filter((e) => articleMatchesAny(e, terms)).map((e) => e.articleId),
      );
      faqs = FAQS.filter((f) => faqMatchesAny(f, terms));
    }

    const sections = HELP_SECTIONS
      .map((s) => ({
        ...s,
        articles: s.articles.filter((a) => matchedIds.has(a.id)),
      }))
      .filter((s) => s.articles.length > 0);

    return { filteredSections: sections, filteredFaqs: faqs };
  }, [q]);

  const hasResults = filteredSections.length > 0 || filteredFaqs.length > 0;

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
          const id = (top.target as HTMLElement).dataset.sectionId;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [filteredSections.length]);

  // Back to top visibility
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Deep link via hash
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeSection = HELP_SECTIONS.find((s) => s.id === activeId) ?? HELP_SECTIONS[0];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#1A1A1A] border-b border-[#FFD700]/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{user ? 'Back to app' : 'Back to login'}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg leading-none">
              <span className="text-[#FFD700] font-bold">F</span>
              <span className="text-white font-bold">iveServ</span>
            </span>
            <span className="text-gray-400 text-xs hidden sm:inline">Help Center</span>
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>Help Center</span>
          <span className="opacity-50">›</span>
          <span className="text-gray-900">{activeSection.title}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">How can we help?</h1>
        <p className="text-sm text-gray-600 mb-5">
          Browse step-by-step guides for FiveServ Operations. Search across every article below.
        </p>
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides, or ask a question..."
            className="pl-9 bg-white border-gray-200 text-gray-900 focus-visible:border-[#FFD700]"
          />
        </div>
      </section>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 pb-24 grid gap-8 md:grid-cols-[240px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-20">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">Sections</p>
            <nav className="flex flex-col gap-0.5">
              {HELP_SECTIONS.map((s) => {
                const isActive = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={cn(
                      'text-left text-sm rounded-md px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-[#FFD700]/10 text-gray-900 font-medium border-l-2 border-[#FFD700] pl-[10px]'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                    )}
                  >
                    <span className="text-[#1A1A1A] font-bold mr-2">{s.number}.</span>
                    {s.title}
                  </button>
                );
              })}
              <button
                onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-left text-sm rounded-md px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 mt-2"
              >
                FAQs
              </button>
            </nav>
          </div>
        </aside>

        {/* Mobile section picker */}
        <div className="md:hidden">
          <Collapsible>
            <CollapsibleTrigger className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-md px-4 py-3 text-sm text-gray-900">
              <span>Browse sections</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 flex flex-col gap-1 bg-white border border-gray-100 rounded-md p-2">
              {HELP_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="text-left text-sm rounded px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  <span className="text-[#FFD700] font-bold mr-2">{s.number}.</span>
                  {s.title}
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Content */}
        <main className="min-w-0">
          {!hasResults && (
            <Card className="bg-white border border-gray-100 p-6 text-center shadow-none">
              <p className="text-sm text-gray-900">
                No results for <span className="text-[#FFD700] font-semibold">"{q}"</span> — try different words or browse the sections below
              </p>
            </Card>
          )}

          {filteredSections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              data-section-id={section.id}
              ref={(el) => (sectionRefs.current[section.id] = el)}
              className="scroll-mt-24 mb-10"
            >
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-[#FFD700] text-[#1A1A1A] rounded-md font-bold hover:bg-[#FFD700]">{section.number}</Badge>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">
                  <Highlight text={section.title} query={q} />
                </h2>
              </div>

              <div className="flex flex-col gap-3">
                {section.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} query={q} />
                ))}
              </div>
            </section>
          ))}

          {/* FAQ */}
          {filteredFaqs.length > 0 && (
            <section id="faq" className="scroll-mt-24 mt-12">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-[#FFD700] text-[#1A1A1A] rounded-md font-bold hover:bg-[#FFD700]">FAQ</Badge>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Frequently Asked Questions</h2>
              </div>
              <Card className="bg-white border border-gray-100 p-2 shadow-none">
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((f, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-gray-100">
                      <AccordionTrigger className="text-left text-sm font-medium hover:no-underline px-3 text-gray-900">
                        <Highlight text={f.q} query={q} />
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-gray-600 px-3">
                        <Highlight text={f.a} query={q} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </section>
          )}

          {/* Footer */}
          <div className="mt-12 border-t border-gray-100 pt-6 text-center">
            <p className="text-xs text-gray-600">
              Still need help? Contact your Admin or email{' '}
              <a href="mailto:info@fiveserv.net" className="text-[#FFD700] hover:underline inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> info@fiveserv.net
              </a>
            </p>
            <p className="text-[10px] text-gray-400 mt-2">FiveServ Operations · Help Center</p>
          </div>
        </main>
      </div>

      {/* Back to top */}
      {showTop && (
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full bg-[#FFD700] text-[#1A1A1A] hover:bg-[#FFD700]/90 shadow-lg p-0"
          aria-label="Back to top"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

// =====================================================================
// Article card
// =====================================================================

const ArticleCard = ({ article, query }: { article: Article; query: string }) => {
  return (
    <Card id={`article-${article.id}`} className="bg-white border border-gray-100 p-5 scroll-mt-24 shadow-none">
      <div className="flex items-start gap-3 mb-3">
        <span className="shrink-0 inline-flex items-center justify-center text-[11px] font-bold px-2 py-0.5 rounded bg-[#FFD700]/15 text-[#1A1A1A]">
          {article.number}
        </span>
        <h3 className="text-base font-semibold text-gray-900 tracking-tight">
          <Highlight text={article.title} query={query} />
        </h3>
      </div>

      {article.kind === 'prose' && (
        <p className="text-sm text-gray-600 leading-relaxed">
          <Highlight text={article.body as string} query={query} />
        </p>
      )}

      {article.kind === 'steps' && (
        <ol className="space-y-2 list-none pl-0">
          {(article.body as string[]).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold inline-flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">
                <Highlight text={step} query={query} />
              </span>
            </li>
          ))}
        </ol>
      )}

      {article.kind === 'list' && (
        <ul className="space-y-2.5">
          {(article.body as DefItem[]).map((it, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold text-gray-900">
                <Highlight text={it.label} query={query} />
              </span>
              <span className="text-gray-500"> — </span>
              <span className="text-gray-600">
                <Highlight text={it.description} query={query} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {article.tip && (
        <div className="mt-4 bg-[#FFD700]/10 border-l-4 border-[#FFD700] text-gray-800 text-sm p-3 rounded-r">
          <span className="text-[#1A1A1A] font-bold mr-1">Tip:</span>
          <Highlight text={article.tip} query={query} />
        </div>
      )}

      {article.note && (
        <div className="mt-4 bg-amber-50 border-l-4 border-amber-400 text-gray-800 text-sm p-3 rounded-r">
          <span className="text-amber-700 font-bold mr-1">Note:</span>
          <Highlight text={article.note} query={query} />
        </div>
      )}
    </Card>
  );
};

export default HelpCenter;
