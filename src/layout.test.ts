import {
  PHONE_SHELL_MAX_PX,
  TABLET_MIN_WIDTH_PX,
  TABLET_SIX_SHELL_MAX_PX,
  cameraFitInsets,
  estimatedBoardCssPx,
  layoutFor,
  shellWidthCapPx,
} from "./layout";

function assert(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

function checkPhoneColumn(): void {
  assert(shellWidthCapPx(3, 390) === 390, "phone 3×3 uses the full phone width");
  assert(shellWidthCapPx(3, 768) === PHONE_SHELL_MAX_PX, "tablet 3×3 stays phone-capped");
  assert(shellWidthCapPx(3, 1280) === PHONE_SHELL_MAX_PX, "desktop 3×3 stays phone-capped");
  assert(shellWidthCapPx(6, 390) === 390, "phone 6×6 stays in the phone column");
  assert(shellWidthCapPx(6, 430) === PHONE_SHELL_MAX_PX, "large-phone 6×6 stays capped");
}

function checkTabletSixExpands(): void {
  assert(TABLET_MIN_WIDTH_PX === 640, "CSS and JS tablet breakpoint must match");
  assert(shellWidthCapPx(6, 640) === 640, "tablet 6×6 uses the wide viewport");
  assert(shellWidthCapPx(6, 768) === 768, "iPad portrait 6×6 uses nearly full width");
  assert(shellWidthCapPx(6, 1024) === TABLET_SIX_SHELL_MAX_PX, "wide 6×6 caps at 960");
  assert(shellWidthCapPx(6, 1920) === TABLET_SIX_SHELL_MAX_PX, "desktop 6×6 stays capped");
}

function checkLayouts(): void {
  const phone3 = layoutFor(3, 390);
  const tablet3 = layoutFor(3, 768);
  assert(phone3.step === tablet3.step && phone3.scale === tablet3.scale, "3×3 layout is viewport-stable");

  const phone6 = layoutFor(6, 390);
  const tablet6 = layoutFor(6, 768);
  assert(phone6.step === 0.6 && phone6.scale === 0.5, "phone 6×6 keeps the compact cell layout");
  assert(tablet6.scale > phone6.scale && tablet6.step > phone6.step, "tablet 6×6 uses chunkier cells");

  const phoneFit = cameraFitInsets(6, 390);
  const tabletFit = cameraFitInsets(6, 768);
  assert(tabletFit.margin < phoneFit.margin, "tablet 6×6 camera sits closer");
  assert(tabletFit.pad < phoneFit.pad, "tablet 6×6 uses less world pad");
}

function checkBoardGrowsOnTablet(): void {
  const phone = estimatedBoardCssPx(6, 390, 844);
  const tablet = estimatedBoardCssPx(6, 768, 1024);
  assert(tablet.width > phone.width * 1.4, `tablet 6×6 should be clearly wider (${tablet.width} vs ${phone.width})`);
  assert(tablet.height > phone.height * 1.4, `tablet 6×6 should be clearly taller (${tablet.height} vs ${phone.height})`);

  const earlyPhone = estimatedBoardCssPx(3, 390, 844);
  const earlyTablet = estimatedBoardCssPx(3, 768, 1024);
  assert(
    earlyTablet.width <= PHONE_SHELL_MAX_PX,
    "tablet 3×3 must not leave the phone column",
  );
  assert(
    earlyTablet.width < tablet.width * 0.75,
    "early 3×3 on tablet must stay smaller than the 6×6 tablet board",
  );
  assert(
    Math.abs(earlyTablet.width - earlyPhone.width) < 80,
    "3×3 should not balloon on tablet vs phone",
  );
}

checkPhoneColumn();
checkTabletSixExpands();
checkLayouts();
checkBoardGrowsOnTablet();
console.log("tablet 6×6 scale rule ok");
