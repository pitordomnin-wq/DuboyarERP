export type AuthUser = {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  role: string;
  roleId: string;
  pages: string[];
  organizationId: string;
  mailSignature: string | null;
  hasAvatar: boolean;
  avatarAt: string | null;
  organization: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    hasLogo: boolean;
    logoAt: string | null;
  };
};
