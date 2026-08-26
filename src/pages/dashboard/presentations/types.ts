export type SlideObjectType = 'text' | 'image' | 'shape';

interface BaseSlideObject {
  id: string;
  type: SlideObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity?: number;
}

export type TextFontFamily = 'heading' | 'body' | 'serif';

export interface TextObject extends BaseSlideObject {
  type: 'text';
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: 'right' | 'center' | 'left';
  fontFamily?: TextFontFamily;
}

export interface ImageObject extends BaseSlideObject {
  type: 'image';
  url: string;
  cornerRadius?: number;
  shadow?: boolean;
}

export interface ShapeObject extends BaseSlideObject {
  type: 'shape';
  shape: 'rectangle' | 'circle';
  fill: string;
  cornerRadius?: number;
  shadow?: boolean;
  borderWidth?: number;
  borderColor?: string;
}

export type SlideObject = TextObject | ImageObject | ShapeObject;

export interface Slide {
  id: string;
  background: string;
  objects: SlideObject[];
}

export interface PresentationModel {
  id: string;
  ownerId: string;
  title: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface PresentationTemplate {
  id: string;
  nameHe: string;
  descriptionHe: string;
  slides: Slide[];
}

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
