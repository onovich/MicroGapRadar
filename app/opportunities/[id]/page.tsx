import { notFound } from "next/navigation";

import { OpportunityDetail } from "@/components/OpportunityDetail";
import {
  getOpportunityDetailData,
  OpportunityNotFoundError,
  type OpportunityDetailViewModel,
} from "@/lib/opportunities";

export const dynamic = "force-dynamic";

type OpportunityDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailPageProps) {
  const { id } = await params;
  let opportunity: OpportunityDetailViewModel | null;

  try {
    opportunity = await getOpportunityDetailData(id);
  } catch (error) {
    if (error instanceof OpportunityNotFoundError) {
      notFound();
    }

    throw error;
  }

  if (!opportunity) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <OpportunityDetail opportunity={opportunity} />
    </main>
  );
}
