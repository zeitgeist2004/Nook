import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeSvgProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const QRCodeSvg: React.FC<QRCodeSvgProps> = ({
  value,
  size = 200,
  darkColor = '#000000',
  lightColor = '#FFFFFF',
  className,
  style,
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!value) {
      setSvgContent('');
      return;
    }

    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M',
    })
      .then((svg) => {
        if (!isCancelled) {
          setSvgContent(svg);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to generate offline QR Code:', err);
          setError('Erro ao gerar QR code');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [value, size, darkColor, lightColor]);

  if (error) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: lightColor,
          color: '#EF4444',
          fontSize: '12px',
          borderRadius: '12px',
          ...style,
        }}
      >
        {error}
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: lightColor,
          borderRadius: '12px',
          ...style,
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid rgba(0,0,0,0.1)',
            borderTopColor: '#6B7280',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        backgroundColor: lightColor,
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
        lineHeight: 0,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
