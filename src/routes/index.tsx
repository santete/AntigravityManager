import { createFileRoute } from '@tanstack/react-router';
import { CloudAccountList } from '@/components/CloudAccountList';

function HomePage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <CloudAccountList />
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: HomePage,
});
