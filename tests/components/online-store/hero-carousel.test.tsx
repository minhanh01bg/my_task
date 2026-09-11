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
});
