import AdminVerification from "@/components/AdminVerification";
export const metadata = {
  title: "Datakontrol · WebHunt",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <AdminVerification />;
}
