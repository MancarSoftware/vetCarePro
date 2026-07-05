import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { PawPrint, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PetAvatarProps {
  photoPath?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: LucideIcon;
}

export function PetAvatar({
  photoPath,
  alt = 'Foto de perfil de la mascota',
  className,
  iconClassName,
  fallbackIcon: FallbackIcon = PawPrint,
}: PetAvatarProps) {
  const { requestBlob } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    setImageUrl(null);
    if (!photoPath?.startsWith('/')) {
      return () => undefined;
    }

    void requestBlob(photoPath)
      .then((blob) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (mounted) setImageUrl(null);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoPath, requestBlob]);

  return (
    <div
      className={cn(
        'grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-700 shadow-inner shadow-white/60',
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="size-full object-cover object-center"
          draggable={false}
        />
      ) : (
        <FallbackIcon className={cn('size-1/2', iconClassName)} />
      )}
    </div>
  );
}
