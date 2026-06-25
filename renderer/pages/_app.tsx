import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { Shell } from '../components/layout/Shell';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Shell>
      <Component {...pageProps} />
    </Shell>
  );
}
