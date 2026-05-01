// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

declare module "gi://Adw" {
  export * from "@gi-types/adw1";
}

declare module "gi://Adw?version=1" {
  export * from "@gi-types/adw1";
}

declare module "gi://Gst" {
  export * from "@gi-types/gst1";
}

declare module "gi://Gst?version=1.0" {
  export * from "@gi-types/gst1";
}

declare interface GjsGiImports {
  Adw: typeof import("@gi-types/adw1");
  Gst: typeof import("@gi-types/gst1");
}
