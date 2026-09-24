import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_HERO_SLIDES,
  HeroCarousel,
} from "@/features/online-store/landing/hero-carousel";

describe("HeroCarousel Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("render slide đầu tiên với tiêu đề và mô tả mặc định", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    expect(screen.getByText(DEFAULT_HERO_SLIDES[0].title)).toBeInTheDocument();
    expect(
      screen.getByText(DEFAULT_HERO_SLIDES[0].description),
    ).toBeInTheDocument();
  });

  it("chuyển slide khi bấm nút Next (tiếp theo)", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const nextBtn = screen.getByLabelText("Slide tiếp theo");
    fireEvent.click(nextBtn);
    expect(screen.getByText(DEFAULT_HERO_SLIDES[1].title)).toBeInTheDocument();
  });

  it("chuyển slide khi bấm nút Prev (trước đó)", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const prevBtn = screen.getByLabelText("Slide trước đó");
    fireEvent.click(prevBtn);
    // Khi o slide dau bam Prev thi se vong ve slide cuoi cung
    const lastIndex = DEFAULT_HERO_SLIDES.length - 1;
    expect(
      screen.getByText(DEFAULT_HERO_SLIDES[lastIndex].title),
    ).toBeInTheDocument();
  });

  it("chuyển slide khi bấm vào dấu chấm pagination dot", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const dot2 = screen.getByLabelText("Chuyển tới slide 2");
    fireEvent.click(dot2);
    expect(screen.getByText(DEFAULT_HERO_SLIDES[1].title)).toBeInTheDocument();
  });

  it("tự động chuyển slide sau chu kỳ thời gian (auto-play)", () => {
    render(
      <HeroCarousel slides={DEFAULT_HERO_SLIDES} autoPlayInterval={5000} />,
    );
    expect(screen.getByText(DEFAULT_HERO_SLIDES[0].title)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText(DEFAULT_HERO_SLIDES[1].title)).toBeInTheDocument();
  });

  it("tạm dừng và tiếp tục chuyển slide khi bấm nút Play/Pause", () => {
    render(
      <HeroCarousel slides={DEFAULT_HERO_SLIDES} autoPlayInterval={5000} />,
    );

    const pauseBtn = screen.getByLabelText("Tạm dừng slide");
    fireEvent.click(pauseBtn);

    // Khi da tam dung thi het 5s slide khong doi
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("01 / 03")).toBeInTheDocument();

    // Bam tiep tuc
    const playBtn = screen.getByLabelText("Tiếp tục chạy slide");
    fireEvent.click(playBtn);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("02 / 03")).toBeInTheDocument();
  });

  it("hỗ trợ chuyển slide bằng phím mũi tên bàn phím", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const region = screen.getByRole("region", { name: "Khuyến mãi nổi bật" });

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(screen.getByText("02 / 03")).toBeInTheDocument();

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(screen.getByText("01 / 03")).toBeInTheDocument();
  });

  it("hỗ trợ vuốt chạm cảm ứng (touch swipe) để chuyển slide", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const region = screen.getByRole("region", { name: "Khuyến mãi nổi bật" });

    // Vuot sang trai > 50px de sang slide tiep theo
    fireEvent.touchStart(region, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(region);

    expect(screen.getByText("02 / 03")).toBeInTheDocument();
  });

  it("hiển thị các cam kết uy tín và thẻ visual showcase", () => {
    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    expect(screen.getByText("Tồn kho chuẩn xác 100%")).toBeInTheDocument();
    expect(screen.getByText("Độ tươi mới trong ngày")).toBeInTheDocument();
  });

  it("kéo thả chỉ cập nhật vị trí tối đa một lần mỗi khung hình (rAF)", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const region = screen.getByRole("region", { name: "Khuyến mãi nổi bật" });

    fireEvent.touchStart(region, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 190 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 170 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 130 }] });
    // Ba lan di chuyen trong cung mot khung hinh -> chi mot lan xin khung.
    expect(raf).toHaveBeenCalledTimes(1);

    // Buong tay truoc khi khung chay: huy khung dang cho, van tinh vuot.
    fireEvent.touchEnd(region);
    expect(cancel).toHaveBeenCalledWith(1);
    expect(screen.getByText("02 / 03")).toBeInTheDocument();

    raf.mockRestore();
    cancel.mockRestore();
  });

  it("touchcancel kết thúc kéo và hủy khung hình đang chờ", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const region = screen.getByRole("region", { name: "Khuyến mãi nổi bật" });

    fireEvent.touchStart(region, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 180 }] });
    fireEvent.touchCancel(region);
    expect(cancel).toHaveBeenCalledWith(7);

    raf.mockRestore();
    cancel.mockRestore();
  });

  it("gỡ component thì hủy khung hình đang chờ", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 9);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = render(<HeroCarousel slides={DEFAULT_HERO_SLIDES} />);
    const region = screen.getByRole("region", { name: "Khuyến mãi nổi bật" });
    fireEvent.touchStart(region, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(region, { touches: [{ clientX: 180 }] });
    unmount();
    expect(cancel).toHaveBeenCalledWith(9);

    raf.mockRestore();
    cancel.mockRestore();
  });
});
