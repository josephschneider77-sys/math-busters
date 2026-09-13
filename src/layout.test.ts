import {
  PHONE_SHELL_MAX_PX,
  TABLET_MIN_WIDTH_PX,
  TABLET_WIDE_SHELL_MAX_PX,
  cameraFitInsets,
  estimatedBoardCssPx,
  layoutFor,
  shellWidthCapPx,
  usesWideShell,
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
  assert(shellWidthCapPx(9, 390) === 390, "phone 9×9 stays in the phone column");
  assert(!usesWideShell(3) && usesWideShell(6) && usesWideShell(9), "wide shell is 6×6 and 9×9 only");
}

function checkTabletWideExpands(): void {
  assert(TABLET_MIN_WIDTH_PX === 640, "CSS and JS tablet breakpoint must match");
  assert(shellWidthCapPx(6, 640) === 640, "tablet 6×6 uses the wide viewport");
  assert(shellWidthCapPx(6, 768) === 768, "iPad portrait 6×6 uses nearly full width");
  assert(shellWidthCapPx(9, 768) === 768, "iPad portrait 9×9 uses nearly full width");
  assert(shellWidthCapPx(6, 1024) === TABLET_WIDE_SHELL_MAX_PX, "wide 6×6 caps at 960");
  assert(shellWidthCapPx(9, 1920) === TABLET_WIDE_SHELL_MAX_PX, "desktop 9×9 stays capped");
}

function checkLayouts(): void {
  const phone3 = layoutFor(3, 390);
  const tablet3 = layoutFor(3, 768);
  assert(phone3.step === tablet3.step && phone3.scale === tablet3.scale, "3×3 layout is viewport-stable");

  const phone6 = layoutFor(6, 390);
  const tablet6 = layoutFor(6, 768);
  assert(phone6.size === 6 && phone6.step === 0.6 && phone6.scale === 0.5, "phone 6×6 keeps the compact cell layout");
  assert(tablet6.size === 6 && tablet6.scale > phone6.scale && tablet6.step > phone6.step, "tablet 6×6 uses chunkier cells");

  const phone9 = layoutFor(9, 390);
  const tablet9 = layoutFor(9, 768);
  assert(phone9.size === 9 && phone9.scale < phone6.scale, "phone 9×9 uses smaller cells so 81 tiles fit");
  assert(tablet9.size === 9 && tablet9.scale > phone9.scale, "tablet 9×9 uses chunkier cells than phone");

  const phoneFit6 = cameraFitInsets(6, 390);
  const tabletFit6 = cameraFitInsets(6, 768);
  assert(tabletFit6.margin < phoneFit6.margin, "tablet 6×6 camera sits closer");
  assert(tabletFit6.pad < phoneFit6.pad, "tablet 6×6 uses less world pad");

  const phoneFit9 = cameraFitInsets(9, 390);
  const tabletFit9 = cameraFitInsets(9, 768);
  assert(tabletFit9.margin <= phoneFit9.margin, "tablet 9×9 camera sits at least as close");
  assert(tabletFit9.pad < phoneFit9.pad, "tablet 9×9 uses less world pad");
}

function checkBoardGrowsOnTablet(): void {
  const phone6 = estimatedBoardCssPx(6, 390, 844);
  const tablet6 = estimatedBoardCssPx(6, 768, 1024);
  assert(tablet6.width > phone6.width * 1.4, `tablet 6×6 should be clearly wider (${tablet6.width} vs ${phone6.width})`);
  assert(tablet6.height > phone6.height * 1.4, `tablet 6×6 should be clearly taller (${tablet6.height} vs ${phone6.height})`);

  const phone9 = estimatedBoardCssPx(9, 390, 844);
  const tablet9 = estimatedBoardCssPx(9, 768, 1024);
  assert(tablet9.width > phone9.width * 1.4, `tablet 9×9 should be clearly wider (${tablet9.width} vs ${phone9.width})`);
  assert(tablet9.height > phone9.height * 1.4, `tablet 9×9 should be clearly taller (${tablet9.height} vs ${phone9.height})`);

  const earlyPhone = estimatedBoardCssPx(3, 390, 844);
  const earlyTablet = estimatedBoardCssPx(3, 768, 1024);
  assert(
    earlyTablet.width <= PHONE_SHELL_MAX_PX,
    "tablet 3×3 must not leave the phone column",
  );
  assert(
    earlyTablet.width < tablet6.width * 0.75,
    "early 3×3 on tablet must stay smaller than the 6×6 tablet board",
  );
  assert(
    Math.abs(earlyTablet.width - earlyPhone.width) < 80,
    "3×3 should not balloon on tablet vs phone",
  );
}

checkPhoneColumn();
checkTabletWideExpands();
checkLayouts();
checkBoardGrowsOnTablet();
console.log("tablet 6×6 / 9×9 scale rule ok");
