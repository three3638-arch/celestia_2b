"use client";

import { updateContactSubmissionStatus } from "@/lib/actions/contact";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { ContactSubmissionStatus } from "@prisma/client";

const statuses: ContactSubmissionStatus[] = ["NEW", "READ", "REPLIED"];

const labels: Record<ContactSubmissionStatus, string> = {
  NEW: "新建",
  READ: "已读",
  REPLIED: "已回复",
};

export function ContactStatusButton({
  id,
  status,
}: {
  id: string;
  status: ContactSubmissionStatus;
}) {
  const router = useRouter();

  const update = async () => {
    await updateContactSubmissionStatus(id, status);
    router.refresh();
  };

  return (
    <Button size="sm" variant="outline" onClick={update}>
      {labels[status]}
    </Button>
  );
}
