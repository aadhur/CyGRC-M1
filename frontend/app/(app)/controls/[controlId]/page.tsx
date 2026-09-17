import { ControlDetailView } from '@/components/controls/ControlDetailView';

interface ControlDetailPageProps {
    // Next.js 15: dynamic route params are async in the App Router.
    params: Promise<{ controlId: string }>;
}

export default async function ControlDetailPage({ params }: ControlDetailPageProps) {
    const { controlId } = await params;
    return <ControlDetailView controlId={controlId} />;
}