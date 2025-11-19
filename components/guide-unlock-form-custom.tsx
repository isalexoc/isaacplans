"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  category: string;
  guideName: string;
  guideId: string;
};

type Props = {
  category: string;
  guideName: string;
  guideId: string;
  onSubmit: (data: FormData) => Promise<void>;
};

export default function GuideUnlockFormCustom({ 
  category, 
  guideName,
  guideId,
  onSubmit 
}: Props) {
  const locale = useLocale();
  const t = useTranslations("guideDetailPage.form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = t("required");
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = t("required");
    }
    if (!formData.email.trim()) {
      newErrors.email = t("required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("invalidEmail");
    }
    if (!formData.phone.trim()) {
      newErrors.phone = t("required");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        category,
        guideName,
        guideId
      });
    } catch (error) {
      console.error('Form submission error:', error);
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("firstName")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="firstName"
          value={formData.firstName}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          disabled={isSubmitting}
          required
        />
        {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
      </div>

      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("lastName")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="lastName"
          value={formData.lastName}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          disabled={isSubmitting}
          required
        />
        {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("email")} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          disabled={isSubmitting}
          required
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("phone")} <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          disabled={isSubmitting}
          required
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand hover:bg-brand/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting 
          ? t("submitting", { default: "Submitting..." })
          : t("submit")
        }
      </button>
    </form>
  );
}

