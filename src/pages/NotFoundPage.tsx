import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f7f4] p-5">
      <section className="max-w-lg text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <Compass size={28} />
        </span>
        <p className="eyebrow mt-6">404 error</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Page not found</h1>
        <p className="mt-4 leading-7 text-slate-600">
          The page you requested does not exist or may have moved.
        </p>
        <Link to="/" className="button-primary mt-7">
          <ArrowLeft size={17} />
          Return home
        </Link>
      </section>
    </main>
  );
}
