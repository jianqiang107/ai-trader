import LeftPanel from './LeftPanel';
import MidPanel from './MidPanel';
import RightPanel from './RightPanel';

export default function TimingPage() {
  return (
    <div className="flex w-full h-full overflow-hidden">
      <LeftPanel />
      <MidPanel />
      <RightPanel />
    </div>
  );
}
