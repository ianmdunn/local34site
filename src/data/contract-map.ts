export type ContractCategory =
  | 'Core Rights'
  | 'Pay'
  | 'Time and Leave'
  | 'Benefits'
  | 'Job Security'
  | 'Workplace';

export interface ContractArticleMeta {
  title: string;
  category: ContractCategory;
  summary: string;
  related: string[];
}

export const CONTRACT_ARTICLE_META: Record<string, ContractArticleMeta> = {
  'article-v-fair-treatment-of-staff-members': {
    title: 'Article V — Fair Treatment of Staff Members',
    category: 'Core Rights',
    summary: 'Sets just-cause, anti-discrimination, and discipline standards.',
    related: ['article-xxxvi-grievance-and-arbitration-procedure', 'article-vi-staff-members-personnel-files'],
  },
  'article-vii-scheduling-of-hours-of-work': {
    title: 'Article VII — Scheduling of Hours of Work',
    category: 'Time and Leave',
    summary: 'Defines scheduling protections and notice expectations.',
    related: ['article-xii-overtime', 'article-xiii-shift-differentials'],
  },
  'article-x-salaries': {
    title: 'Article X — Salaries',
    category: 'Pay',
    summary: 'Defines salary structures and rate movement provisions.',
    related: ['article-xi-job-descriptions-and-classifications', 'appendix-i-salary-structure'],
  },
  'article-xii-overtime': {
    title: 'Article XII — Overtime',
    category: 'Pay',
    summary: 'Covers overtime eligibility, rates, and compensatory options.',
    related: ['article-vii-scheduling-of-hours-of-work', 'article-xiii-shift-differentials'],
  },
  'article-xiii-shift-differentials': {
    title: 'Article XIII — Shift Differentials',
    category: 'Pay',
    summary: 'Explains premium pay based on shift timing and assignment.',
    related: ['article-vii-scheduling-of-hours-of-work', 'article-xii-overtime'],
  },
  'article-xvii-job-security': {
    title: 'Article XVII — Job Security',
    category: 'Job Security',
    summary: 'Details layoff avoidance, placement, recall, and rights to return.',
    related: ['article-xvi-promotions-and-transfers', 'article-xxxvi-grievance-and-arbitration-procedure'],
  },
  'article-xix-health-insurance': {
    title: 'Article XIX — Health Insurance',
    category: 'Benefits',
    summary: 'Describes medical coverage structure and key eligibility terms.',
    related: ['article-xxi-disability', 'article-xxii-life-insurance', 'supplemental-agreement-viii-health-benefits'],
  },
  'article-xx-sick-leave': {
    title: 'Article XX — Sick Leave',
    category: 'Time and Leave',
    summary: 'Defines sick leave accrual and use provisions.',
    related: ['article-xxi-disability', 'article-xxxv-leaves-of-absence'],
  },
  'article-xxi-disability': {
    title: 'Article XXI — Disability',
    category: 'Benefits',
    summary: 'Outlines disability-related protections and benefits.',
    related: ['article-xx-sick-leave', 'article-xix-health-insurance'],
  },
  'article-xxiii-retirement': {
    title: 'Article XXIII — Retirement',
    category: 'Benefits',
    summary: 'Covers retirement plan references and related terms.',
    related: ['article-xxxiv-mortgage-loan-program'],
  },
  'article-xxiv-holidays': {
    title: 'Article XXIV — Holidays',
    category: 'Time and Leave',
    summary: 'Specifies holiday schedules, pay, and related conditions.',
    related: ['article-xxv-personal-business-days', 'article-xxvi-vacations'],
  },
  'article-xxv-personal-business-days': {
    title: 'Article XXV — Personal Business Days',
    category: 'Time and Leave',
    summary: 'Defines allocation and use of personal business days.',
    related: ['article-xxiv-holidays', 'article-xxvi-vacations'],
  },
  'article-xxvi-vacations': {
    title: 'Article XXVI — Vacations',
    category: 'Time and Leave',
    summary: 'Defines vacation accrual, scheduling, and carryover rules.',
    related: ['article-xxiv-holidays', 'article-xxv-personal-business-days', 'article-xxxv-leaves-of-absence'],
  },
  'article-xxxv-leaves-of-absence': {
    title: 'Article XXXV — Leaves of Absence',
    category: 'Time and Leave',
    summary: 'Covers leave categories, approvals, and return terms.',
    related: ['article-xx-sick-leave', 'article-xxvi-vacations'],
  },
  'article-xxxvi-grievance-and-arbitration-procedure': {
    title: 'Article XXXVI — Grievance and Arbitration Procedure',
    category: 'Core Rights',
    summary: 'Defines grievance steps, filing windows, and arbitration path.',
    related: ['article-v-fair-treatment-of-staff-members', 'article-xvii-job-security'],
  },
};
