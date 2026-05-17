import Image from "next/image";

export function VisualContext() {
  return (
    <div className="glass-card relative mt-12 h-72 w-full overflow-hidden rounded-[2rem] border">
      <Image
        alt="dramatic wide angle shot of a large construction site with cranes and skeletal building structure at blue hour"
        className="h-full w-full object-cover opacity-20 mix-blend-multiply grayscale"
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6HYXFF1uPEn-VBo4Bjk3QP1N5UfkjxcLIdqV3AF66ZED4R7_NYwDI4Tmwhp1dWnbAiEuQ3oJvzUMFParEqaWE3gWXsnNNut8MfbUaGpJQvOcQkYytO8m7tUHAGMEVGVXpaKq2hvwarjewZZQ-sxgBsG4Hjt9jU1ngwsCBjgtYDywEBcFbOjn-zgS9fY108WUkOLByRmri1X-pmG0tGuxvdugxC3uRUg8meFuZeZ9_6ZAqLXK-kmWH_cZQDh4oaDm-HznefFt-nBw0"
        fill
        sizes="100vw"
      />
      <div className="from-background absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-end p-8">
        <div className="max-w-xl">
          <span className="bg-primary-container/12 text-primary border-primary/12 mb-3 inline-flex rounded-full border px-4 py-1 text-[11px] font-bold tracking-[0.12em] uppercase backdrop-blur">
            Reference Context
          </span>
          <h4 className="font-h2 text-h2 text-on-surface">Institutional Center Phase II</h4>
          <p className="text-on-surface-variant mt-3 max-w-md text-sm">
            Estimated project scope covers 45,000 sqm of LEED-certified office space, municipal
            infrastructure, and multi-phase technical support delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
