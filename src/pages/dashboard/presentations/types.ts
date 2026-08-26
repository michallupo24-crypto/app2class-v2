export type SlideObjectType = 'text' | 'image' | 'shape';

interface BaseSlideObject {
  id: string;
  type: SlideObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface TextObject extends BaseSlideObject {
  type: 'text';
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: 'right' | 'center' | 'left';
}

export interface ImageObject extends BaseSlideObject {
  type: 'image';
  url: string;
}

export interface ShapeObject extends BaseSlideObject {
  type: 'shape';
  shape: 'rectangle' | 'circle';
  fill: string;
}

export type SlideObject = TextObject | ImageObject | ShapeObject;

export interface Slide {
  id: string;
  background: string;
  objects: SlideObject[];
}

export interface PresentationModel {
  id: string;
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
