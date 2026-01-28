export interface JwtUser {
  id: string;
  email?: string;
  studioId: string;
  role: "owner" | "admin" | "member";
}
