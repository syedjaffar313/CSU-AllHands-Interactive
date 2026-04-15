import DisplayClient from './DisplayClient';

export function generateStaticParams() {
  return [{ eventCode: [] }];
}

export default function DisplayPage() {
  return <DisplayClient />;
}
