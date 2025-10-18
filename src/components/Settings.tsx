import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_PROFILE = 'https://functions.poehali.dev/08cca8cc-c006-450f-adcb-24ef706d1545';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status?: string;
}

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  token: string;
  onLogout: () => void;
  onUpdate: (user: User) => void;
}

export const Settings = ({ open, onOpenChange, user, token, onLogout, onUpdate }: SettingsProps) => {
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showUserAgreement, setShowUserAgreement] = useState(false);
  const [emailData, setEmailData] = useState({ email: user.email, password: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleEmailChange = async () => {
    if (!emailData.email || !emailData.password) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_PROFILE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          action: 'change_email',
          email: emailData.email,
          password: emailData.password,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const updatedUser = { ...user, email: data.email };
        onUpdate(updatedUser);
        localStorage.setItem('vnechat_user', JSON.stringify(updatedUser));
        toast({ title: 'Успешно', description: 'Email изменён' });
        setShowEmailChange(false);
        setEmailData({ email: data.email, password: '' });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось изменить email', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast({ title: 'Ошибка', description: 'Введите пароль', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_PROFILE, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast({ title: 'Аккаунт удалён', description: 'Ваш аккаунт был успешно удалён' });
        onLogout();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить аккаунт', variant: 'destructive' });
    } finally {
      setLoading(false);
      setShowDeleteAccount(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Настройки</DialogTitle>
            <DialogDescription>Управление аккаунтом и приложением</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Account Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">АККАУНТ</h3>
              
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{user.email}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowEmailChange(true)}
                    className="h-8"
                  >
                    <Icon name="Edit" size={14} className="mr-1" />
                    Изменить
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* About Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">О ПРИЛОЖЕНИИ</h3>
              
              <Button 
                variant="ghost" 
                className="w-full justify-start h-auto p-3" 
                onClick={() => setShowUserAgreement(true)}
              >
                <Icon name="FileText" size={18} className="mr-3" />
                <div className="text-left">
                  <div className="font-medium">Пользовательское соглашение</div>
                  <div className="text-xs text-muted-foreground">Условия использования VneChat</div>
                </div>
              </Button>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Icon name="Info" size={18} />
                  <div className="text-sm">
                    <div className="font-medium">Версия</div>
                    <div className="text-xs text-muted-foreground">1.0.0</div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">ДЕЙСТВИЯ</h3>
              
              <Button 
                variant="ghost" 
                className="w-full justify-start text-orange-600 hover:text-orange-600 hover:bg-orange-50 h-auto p-3"
                onClick={onLogout}
              >
                <Icon name="LogOut" size={18} className="mr-3" />
                <div className="text-left">
                  <div className="font-medium">Выйти из аккаунта</div>
                  <div className="text-xs opacity-70">Вы сможете войти снова позже</div>
                </div>
              </Button>

              <Button 
                variant="ghost" 
                className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50 h-auto p-3"
                onClick={() => setShowDeleteAccount(true)}
              >
                <Icon name="Trash2" size={18} className="mr-3" />
                <div className="text-left">
                  <div className="font-medium">Удалить аккаунт</div>
                  <div className="text-xs opacity-70">Это действие необратимо</div>
                </div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={showEmailChange} onOpenChange={setShowEmailChange}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить Email</DialogTitle>
            <DialogDescription>Введите новый email и пароль для подтверждения</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Новый email</Label>
              <Input
                id="new-email"
                type="email"
                value={emailData.email}
                onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтвердите паролем</Label>
              <Input
                id="confirm-password"
                type="password"
                value={emailData.password}
                onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
                placeholder="Ваш текущий пароль"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailChange(false)}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
            <Button 
              onClick={handleEmailChange} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Сохранение...' : 'Изменить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Alert */}
      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent className="w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все ваши данные, сообщения и контакты будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-password">Подтвердите паролем</Label>
            <Input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Введите пароль"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto m-0">Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={loading}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 m-0"
            >
              {loading ? 'Удаление...' : 'Удалить аккаунт'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Agreement Dialog */}
      <Dialog open={showUserAgreement} onOpenChange={setShowUserAgreement}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Пользовательское соглашение</DialogTitle>
            <DialogDescription>VneChat - Условия использования</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. Принятие условий</h3>
                <p className="text-muted-foreground">
                  Используя VneChat, вы соглашаетесь с настоящими условиями использования. Если вы не согласны с какими-либо условиями, пожалуйста, не используйте приложение.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">2. Описание сервиса</h3>
                <p className="text-muted-foreground">
                  VneChat предоставляет платформу для обмена мгновенными сообщениями, аудио и видео звонков между пользователями. Сервис предоставляется "как есть".
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">3. Регистрация аккаунта</h3>
                <p className="text-muted-foreground">
                  Вы обязаны предоставить точную и актуальную информацию при регистрации. Вы несёте ответственность за сохранность пароля и всех действий, совершённых под вашим аккаунтом.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">4. Конфиденциальность</h3>
                <p className="text-muted-foreground">
                  Мы уважаем вашу конфиденциальность и обязуемся защищать ваши персональные данные. Подробная информация о сборе и использовании данных доступна в нашей Политике конфиденциальности.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">5. Правила поведения</h3>
                <p className="text-muted-foreground">
                  Запрещается использовать сервис для распространения вредоносного контента, спама, незаконной деятельности или нарушения прав других пользователей.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">6. Интеллектуальная собственность</h3>
                <p className="text-muted-foreground">
                  Все права на программное обеспечение, дизайн и контент VneChat принадлежат разработчикам. Запрещается копирование, модификация или распространение без разрешения.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">7. Ограничение ответственности</h3>
                <p className="text-muted-foreground">
                  VneChat не несёт ответственности за любые прямые или косвенные убытки, возникшие в результате использования или невозможности использования сервиса.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">8. Изменения условий</h3>
                <p className="text-muted-foreground">
                  Мы оставляем за собой право изменять эти условия в любое время. Продолжение использования сервиса после изменений означает ваше согласие с новыми условиями.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">9. Контакты</h3>
                <p className="text-muted-foreground">
                  По всем вопросам обращайтесь: support@vnechat.com
                </p>
              </section>

              <p className="text-xs text-muted-foreground mt-6">
                Последнее обновление: Октябрь 2025
              </p>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowUserAgreement(false)} className="w-full sm:w-auto">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { ScrollArea } from '@/components/ui/scroll-area';
