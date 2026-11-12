// Tab row on record pages (customer, plan). On phones the icons are hidden and the row
// scrolls sideways, so five tabs fit without being cut off; from `sm` up it is unchanged.
export const RECORD_TABS =
  "no-scrollbar w-full justify-start overflow-x-auto sm:w-auto " +
  "max-sm:[&_[data-slot=tabs-trigger]]:flex-none max-sm:[&_[data-slot=tabs-trigger]]:px-2.5 " +
  "max-sm:[&_[data-slot=tabs-trigger]>svg]:hidden";

// Filter pills (period / status) that must fit on a phone.
export const FILTER_PILLS = "no-scrollbar overflow-x-auto max-sm:[&>*]:px-2.5";
