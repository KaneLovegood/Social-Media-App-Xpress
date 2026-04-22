import Image from 'next/image';

export default function ChatNoRoomWelcome() {
  return (
    <section className="relative flex h-full min-h-0 flex-col items-center justify-center bg-[#f6f7fb] px-6 py-6 text-center">
      <button
        type="button"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1c64f2] opacity-90 lg:left-6"
        aria-label="Previous"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>

      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1c64f2] opacity-90 lg:right-6"
        aria-label="Next"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <h2 className="text-3xl font-semibold text-[#132b57] lg:text-2xl">
        Chào mừng đến với <span className="font-bold text-[#fe9617d2]">Xpress</span>
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-[1.5] text-[#2a3f6a] lg:text-lg">
        Khám phá những tiện ích hỗ trợ trò chuyện cùng người thân, bạn bè
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#d4dbeb] bg-[#131c2e] shadow-[0_10px_22px_rgba(10,23,55,0.16)]">
        <Image
          src="/assets/noChatRoom_image1.jpg"
          alt="Xpress desktop preview"
          width={680}
          height={390}
          className="h-auto w-[300px] object-cover lg:w-[350px]"
          priority
        />
      </div>

      <h3 className="mt-6 text-2xl font-medium text-[#fe9617d2] lg:text-2xl">Giao diện thông minh</h3>
      <p className="mt-2 text-md text-[#22365f] lg:text-lg max-w-3xl">
        Bắt đầu cuộc trò chuyện của bạn với giao diện được thiết kế tối ưu cho máy tính để bàn,
        giúp bạn dễ dàng theo dõi và quản lý các cuộc trò chuyện của mình.
      </p>

      <button
        type="button"
        className="mt-5 rounded-lg bg-[#fe9617d2] px-6 py-2.5 text-md font-semibol"
      >
        Thử ngay
      </button>

      <div className="mt-6 flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-[#fe9617d2]" />
        <span className="h-2 w-2 rounded-full bg-[#cfd5e0]" />
        <span className="h-2 w-2 rounded-full bg-[#cfd5e0]" />
        <span className="h-2 w-2 rounded-full bg-[#cfd5e0]" />
      </div>
    </section>
  );
}
