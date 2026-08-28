"use client";

import React from "react";
import { BaseModal, BaseModalProps } from "./BaseModal";

export interface ModalProps extends BaseModalProps {}

export function Modal(props: ModalProps) {
  return <BaseModal {...props} />;
}

export default Modal;
