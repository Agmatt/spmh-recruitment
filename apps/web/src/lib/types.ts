export type JobStatus = 'draft' | 'published' | 'archived' | 'closed';
export type EmploymentType =
  | 'full_time' | 'part_time' | 'contract' | 'internship' | 'locum';

export interface Department {
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

export interface JobPosting {
  id: string;
  slug: string;
  title: string;
  department_id: string | null;
  employment_type: EmploymentType;
  location: string;
  summary: string | null;
  description_md: string;
  requirements_md: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  status: JobStatus;
  published_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobWithDepartment extends JobPosting {
  departments: Pick<Department, 'slug' | 'label'> | null;
}