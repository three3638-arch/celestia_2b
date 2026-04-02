"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Upload, X, Star, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 图片项类型
export interface ImageItem {
  id?: string;
  url: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  sortOrder: number;
  file?: File;
  isUploading?: boolean;
  uploadProgress?: number;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  disabled,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 上传图片到服务器
  const uploadImage = async (file: File): Promise<{ url: string; thumbnailUrl: string } | null> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      return {
        url: data.url,
        thumbnailUrl: data.thumbnailUrl || data.url,
      };
    } catch (error) {
      console.error("Failed to upload image:", error);
      return null;
    }
  };

  // 处理文件选择
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const remainingSlots = maxImages - images.length;
      if (remainingSlots <= 0) {
        setUploadErrors([`最多只能上传 ${maxImages} 张图片`]);
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newErrors: string[] = [];

      // 创建临时图片项（显示上传中状态）
      const tempImages: ImageItem[] = filesToProcess.map((file, index) => ({
        url: URL.createObjectURL(file),
        thumbnailUrl: URL.createObjectURL(file),
        isPrimary: images.length === 0 && index === 0, // 第一张设为主图
        sortOrder: images.length + index,
        file,
        isUploading: true,
        uploadProgress: 0,
      }));

      // 先添加到列表显示上传状态
      onChange([...images, ...tempImages]);

      // 逐个上传
      const uploadedImages: ImageItem[] = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const result = await uploadImage(file);

        if (result) {
          uploadedImages.push({
            url: result.url,
            thumbnailUrl: result.thumbnailUrl,
            isPrimary: images.length === 0 && i === 0,
            sortOrder: images.length + i,
            isUploading: false,
            uploadProgress: 100,
          });
        } else {
          newErrors.push(`"${file.name}" 上传失败`);
        }
      }

      // 更新图片列表：移除临时项，添加已上传的
      const currentImages = images.filter((img) => !img.isUploading);
      onChange([...currentImages, ...uploadedImages]);

      if (newErrors.length > 0) {
        setUploadErrors(newErrors);
        setTimeout(() => setUploadErrors([]), 5000);
      }
    },
    [images, maxImages, onChange]
  );

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // 删除图片
  const removeImage = (index: number) => {
    const newImages = [...images];
    const removed = newImages.splice(index, 1)[0];

    // 如果删除的是主图，将第一张设为主图
    if (removed.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true;
    }

    // 重新排序
    newImages.forEach((img, i) => {
      img.sortOrder = i;
    });

    onChange(newImages);
  };

  // 设置主图
  const setPrimary = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(newImages);
  };

  // 移动图片位置
  const moveImage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === images.length - 1) return;

    const newImages = [...images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newImages[index], newImages[targetIndex]] = [
      newImages[targetIndex],
      newImages[index],
    ];

    // 更新排序
    newImages.forEach((img, i) => {
      img.sortOrder = i;
    });

    onChange(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      {canAddMore && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-card"
          )}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-foreground font-medium">
            点击选择文件或拖拽上传
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 JPG、PNG、WebP 格式，最多 {maxImages} 张图片
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled}
          />
        </div>
      )}

      {/* 错误提示 */}
      {uploadErrors.length > 0 && (
        <div className="space-y-1">
          {uploadErrors.map((error, index) => (
            <p key={index} className="text-sm text-destructive">
              {error}
            </p>
          ))}
        </div>
      )}

      {/* 图片网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className={cn(
                "relative group aspect-square rounded-lg overflow-hidden border",
                image.isPrimary
                  ? "border-primary ring-1 ring-primary"
                  : "border-border"
              )}
            >
              {/* 图片 */}
              <Image
                src={image.thumbnailUrl || image.url}
                alt={`商品图片 ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              />

              {/* 上传中遮罩 */}
              {image.isUploading && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground mt-2">
                    上传中...
                  </span>
                </div>
              )}

              {/* 主图标记 */}
              {image.isPrimary && !image.isUploading && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  主图
                </div>
              )}

              {/* 悬停操作栏 */}
              {!image.isUploading && !disabled && (
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  {/* 设为主图 */}
                  {!image.isPrimary && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPrimary(index)}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      设为主图
                    </Button>
                  )}

                  {/* 排序按钮 */}
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, "up")}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, "down")}
                      disabled={index === images.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 删除按钮 */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 提示信息 */}
      {images.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          暂无图片，请上传至少一张商品图片
        </p>
      )}

      {/* 图片计数 */}
      <p className="text-xs text-muted-foreground text-right">
        {images.length} / {maxImages} 张图片
      </p>
    </div>
  );
}
