export type Category = "pothole" | "stalled_construction" | "public_renovation" | "broken_infra" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  pothole: "Дупка на пътя",
  stalled_construction: "Спрял строеж",
  public_renovation: "Занемарен обществен ремонт",
  broken_infra: "Счупена инфраструктура",
  other: "Друго",
};

export interface Suggestion {
  ocid: string;
  title: string;
  value: number | null;
  overrun_days: number | null;
  supplier: string;
}
export interface ReportPin {
  id: number;
  lat: number;
  lng: number;
  category: Category;
  status: string;
  region_name: string | null;
  confirmations: number;
}
export interface ReportDetail extends ReportPin {
  note: string;
  suggested_contracts: Suggestion[];
}
export interface Session {
  token: string;
  user_id: number;
  name: string;
}
