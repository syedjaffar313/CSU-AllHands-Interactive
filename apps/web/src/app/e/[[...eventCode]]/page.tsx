import JoinClient from './JoinClient';

export function generateStaticParams() {
  return [{ eventCode: [] }];
}

export default function JoinPage() {
  return <JoinClient />;
}
