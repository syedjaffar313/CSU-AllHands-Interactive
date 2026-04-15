import LiveClient from './LiveClient';

export function generateStaticParams() {
  return [{ eventCode: [] }];
}

export default function LivePage() {
  return <LiveClient />;
}
