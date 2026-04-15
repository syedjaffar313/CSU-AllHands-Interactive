import ControlClient from './ControlClient';

export function generateStaticParams() {
  return [{ eventCode: [] }];
}

export default function ControlPage() {
  return <ControlClient />;
}
