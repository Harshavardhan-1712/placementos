import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../ui";
import DriveForm from "./DriveForm";

export default function DriveNew() {
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="New recruitment drive" subtitle="Saved as a draft. Publish it when you're ready to open registration." />
      <div className="card p-4 sm:p-6"><DriveForm submitLabel="Create draft" onSubmit={async (b) => { const d = await api.createDrive(b); nav(`/drives/${d.id}`); }} /></div>
    </>
  );
}
