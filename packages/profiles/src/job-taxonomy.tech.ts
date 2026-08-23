/**
 * Tech (software org) job-function taxonomy (D10 — docs/guides/01-library-artifactory.md §3).
 *
 * Hand-curated (~60 roles) — unlike the manufacturing taxonomy, there is no
 * OEM research sweep for software orgs, so this is authored directly from
 * common software-company org structures: Engineering, Product & Design,
 * Data & Analytics, IT & Corporate Systems, Sales & Marketing, Business
 * Operations, and Leadership. `headcountWeight` is a relative sizing hint
 * (fixture data, not a real customer metric) — individual-contributor roles
 * weighted highest, C-suite lowest.
 *
 * Kept as a same-package sibling module — `packages/profiles` stays a leaf
 * package with zero cross-package imports.
 */

import type { JobFunctionSeed } from "./types.js";

export const TECH_JOB_FUNCTIONS: JobFunctionSeed[] = [
  { key: "backend_engineer", name: "Backend Engineer", functionFamily: "Engineering", aliases: ["backend developer", "backend engineer", "server-side engineer"], headcountWeight: 20 },
  { key: "frontend_engineer", name: "Frontend Engineer", functionFamily: "Engineering", aliases: ["frontend developer", "frontend engineer", "ui engineer"], headcountWeight: 20 },
  { key: "full_stack_engineer", name: "Full-Stack Engineer", functionFamily: "Engineering", aliases: ["full stack engineer", "full-stack engineer", "fullstack developer"], headcountWeight: 20 },
  { key: "mobile_engineer_ios", name: "Mobile Engineer (iOS)", functionFamily: "Engineering", aliases: ["ios developer", "ios engineer", "mobile engineer (ios)"], headcountWeight: 12 },
  { key: "mobile_engineer_android", name: "Mobile Engineer (Android)", functionFamily: "Engineering", aliases: ["android developer", "android engineer", "mobile engineer (android)"], headcountWeight: 12 },
  { key: "embedded_engineer", name: "Embedded Engineer", functionFamily: "Engineering", aliases: ["embedded developer", "embedded engineer", "firmware engineer"], headcountWeight: 8 },
  { key: "platform_engineer", name: "Platform Engineer", functionFamily: "Engineering", aliases: ["infrastructure engineer", "platform engineer"], headcountWeight: 12 },
  { key: "site_reliability_engineer", name: "Site Reliability Engineer", functionFamily: "Engineering", aliases: ["reliability engineer", "site reliability engineer", "sre"], headcountWeight: 12 },
  { key: "devops_engineer", name: "DevOps Engineer", functionFamily: "Engineering", aliases: ["devops", "devops engineer"], headcountWeight: 14 },
  { key: "security_engineer", name: "Security Engineer", functionFamily: "Engineering", aliases: ["appsec engineer", "product security engineer", "security engineer"], headcountWeight: 8 },
  { key: "qa_test_engineer", name: "QA / Test Engineer", functionFamily: "Engineering", aliases: ["qa / test engineer", "qa engineer", "sdet", "test engineer"], headcountWeight: 14 },
  { key: "machine_learning_engineer", name: "Machine Learning Engineer", functionFamily: "Engineering", aliases: ["machine learning engineer", "ml engineer"], headcountWeight: 10 },
  { key: "ai_research_engineer", name: "AI Research Engineer", functionFamily: "Engineering", aliases: ["ai research engineer", "ai researcher"], headcountWeight: 6 },
  { key: "data_engineer", name: "Data Engineer", functionFamily: "Engineering", aliases: ["data engineer", "data pipeline engineer"], headcountWeight: 12 },
  { key: "engineering_manager", name: "Engineering Manager", functionFamily: "Engineering", aliases: ["em", "engineering manager"], headcountWeight: 8 },
  { key: "staff_engineer", name: "Staff Engineer", functionFamily: "Engineering", aliases: ["staff engineer", "staff swe"], headcountWeight: 4 },
  { key: "principal_engineer", name: "Principal Engineer", functionFamily: "Engineering", aliases: ["principal engineer", "principal swe"], headcountWeight: 2 },
  { key: "tech_lead", name: "Tech Lead", functionFamily: "Engineering", aliases: ["tech lead", "technical lead"], headcountWeight: 8 },
  { key: "solutions_architect", name: "Solutions Architect", functionFamily: "Engineering", aliases: ["solution architect", "solutions architect"], headcountWeight: 6 },
  { key: "release_engineer", name: "Release Engineer", functionFamily: "Engineering", aliases: ["build engineer", "release engineer"], headcountWeight: 6 },
  { key: "code_reviewer", name: "Code Reviewer", functionFamily: "Engineering", aliases: ["code reviewer", "reviewer"], headcountWeight: 10 },
  { key: "product_manager", name: "Product Manager", functionFamily: "Product & Design", aliases: ["pm", "product manager"], headcountWeight: 10 },
  { key: "product_designer", name: "Product Designer", functionFamily: "Product & Design", aliases: ["product designer", "ux/ui designer"], headcountWeight: 8 },
  { key: "ux_researcher", name: "UX Researcher", functionFamily: "Product & Design", aliases: ["user researcher", "ux researcher"], headcountWeight: 4 },
  { key: "technical_writer", name: "Technical Writer", functionFamily: "Product & Design", aliases: ["docs engineer", "documentation writer", "technical writer"], headcountWeight: 6 },
  { key: "product_analyst", name: "Product Analyst", functionFamily: "Product & Design", aliases: ["product analyst", "product data analyst"], headcountWeight: 8 },
  { key: "data_scientist", name: "Data Scientist", functionFamily: "Data & Analytics", aliases: ["data scientist", "ds"], headcountWeight: 10 },
  { key: "analytics_engineer", name: "Analytics Engineer", functionFamily: "Data & Analytics", aliases: ["analytics engineer"], headcountWeight: 8 },
  { key: "bi_analyst", name: "BI Analyst", functionFamily: "Data & Analytics", aliases: ["bi analyst", "business intelligence analyst"], headcountWeight: 8 },
  { key: "data_analyst", name: "Data Analyst", functionFamily: "Data & Analytics", aliases: ["data analyst"], headcountWeight: 12 },
  { key: "it_support_specialist", name: "IT Support Specialist", functionFamily: "IT & Corporate Systems", aliases: ["helpdesk", "it support", "it support specialist"], headcountWeight: 14 },
  { key: "network_engineer", name: "Network Engineer", functionFamily: "IT & Corporate Systems", aliases: ["network engineer"], headcountWeight: 8 },
  { key: "systems_administrator", name: "Systems Administrator", functionFamily: "IT & Corporate Systems", aliases: ["sysadmin", "systems administrator"], headcountWeight: 8 },
  { key: "it_security_analyst", name: "IT Security Analyst", functionFamily: "IT & Corporate Systems", aliases: ["corporate security analyst", "it security analyst"], headcountWeight: 6 },
  { key: "enterprise_applications_engineer", name: "Enterprise Applications Engineer", functionFamily: "IT & Corporate Systems", aliases: ["enterprise applications engineer", "erp admin"], headcountWeight: 6 },
  { key: "account_executive", name: "Account Executive", functionFamily: "Sales & Marketing", aliases: ["account executive", "ae"], headcountWeight: 12 },
  { key: "sales_development_representative", name: "Sales Development Representative", functionFamily: "Sales & Marketing", aliases: ["bdr", "sales development representative", "sdr"], headcountWeight: 14 },
  { key: "sales_engineer", name: "Sales Engineer", functionFamily: "Sales & Marketing", aliases: ["sales engineer", "solutions engineer (sales)"], headcountWeight: 8 },
  { key: "customer_success_manager", name: "Customer Success Manager", functionFamily: "Sales & Marketing", aliases: ["csm", "customer success manager"], headcountWeight: 12 },
  { key: "marketing_manager", name: "Marketing Manager", functionFamily: "Sales & Marketing", aliases: ["marketing manager"], headcountWeight: 8 },
  { key: "growth_marketing_manager", name: "Growth Marketing Manager", functionFamily: "Sales & Marketing", aliases: ["growth marketer", "growth marketing manager"], headcountWeight: 6 },
  { key: "content_marketing_manager", name: "Content Marketing Manager", functionFamily: "Sales & Marketing", aliases: ["content marketer", "content marketing manager"], headcountWeight: 6 },
  { key: "demand_generation_manager", name: "Demand Generation Manager", functionFamily: "Sales & Marketing", aliases: ["demand gen", "demand generation manager"], headcountWeight: 6 },
  { key: "developer_relations_engineer", name: "Developer Relations Engineer", functionFamily: "Sales & Marketing", aliases: ["developer relations engineer", "devrel"], headcountWeight: 4 },
  { key: "support_engineer", name: "Support Engineer", functionFamily: "Sales & Marketing", aliases: ["support engineer", "technical support engineer"], headcountWeight: 12 },
  { key: "finance_analyst", name: "Finance Analyst", functionFamily: "Business Operations", aliases: ["finance analyst", "fp&a analyst"], headcountWeight: 8 },
  { key: "controller", name: "Controller", functionFamily: "Business Operations", aliases: ["controller"], headcountWeight: 4 },
  { key: "recruiter", name: "Recruiter", functionFamily: "Business Operations", aliases: ["recruiter", "talent acquisition"], headcountWeight: 10 },
  { key: "hr_business_partner", name: "HR Business Partner", functionFamily: "Business Operations", aliases: ["hr business partner", "hrbp"], headcountWeight: 6 },
  { key: "people_operations_specialist", name: "People Operations Specialist", functionFamily: "Business Operations", aliases: ["people operations specialist", "people ops"], headcountWeight: 6 },
  { key: "legal_counsel", name: "Legal Counsel", functionFamily: "Business Operations", aliases: ["legal counsel"], headcountWeight: 4 },
  { key: "office_manager", name: "Office Manager", functionFamily: "Business Operations", aliases: ["office manager"], headcountWeight: 6 },
  { key: "executive_assistant", name: "Executive Assistant", functionFamily: "Business Operations", aliases: ["ea", "executive assistant"], headcountWeight: 6 },
  { key: "business_operations_analyst", name: "Business Operations Analyst", functionFamily: "Business Operations", aliases: ["bizops analyst", "business operations analyst"], headcountWeight: 8 },
  { key: "procurement_specialist", name: "Procurement Specialist", functionFamily: "Business Operations", aliases: ["procurement specialist"], headcountWeight: 6 },
  { key: "chief_executive_officer", name: "Chief Executive Officer", functionFamily: "Leadership", aliases: ["ceo", "chief executive officer"], headcountWeight: 1 },
  { key: "chief_technology_officer", name: "Chief Technology Officer", functionFamily: "Leadership", aliases: ["chief technology officer", "cto"], headcountWeight: 1 },
  { key: "vp_of_engineering", name: "VP of Engineering", functionFamily: "Leadership", aliases: ["vp eng", "vp of engineering"], headcountWeight: 2 },
  { key: "director_of_engineering", name: "Director of Engineering", functionFamily: "Leadership", aliases: ["director of engineering"], headcountWeight: 3 },
  { key: "chief_product_officer", name: "Chief Product Officer", functionFamily: "Leadership", aliases: ["chief product officer", "cpo"], headcountWeight: 1 },
  { key: "chief_financial_officer", name: "Chief Financial Officer", functionFamily: "Leadership", aliases: ["cfo", "chief financial officer"], headcountWeight: 1 },
  { key: "chief_revenue_officer", name: "Chief Revenue Officer", functionFamily: "Leadership", aliases: ["chief revenue officer", "cro"], headcountWeight: 1 },
  { key: "vp_of_sales", name: "VP of Sales", functionFamily: "Leadership", aliases: ["vp of sales"], headcountWeight: 2 },
  { key: "vp_of_marketing", name: "VP of Marketing", functionFamily: "Leadership", aliases: ["vp of marketing"], headcountWeight: 2 },
  { key: "head_of_people", name: "Head of People", functionFamily: "Leadership", aliases: ["chro", "head of people", "vp people"], headcountWeight: 2 },
];
