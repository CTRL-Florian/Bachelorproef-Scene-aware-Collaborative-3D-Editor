import React from 'react';
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Menu from '@/header/menu/Menu';
import UserAvatars from '@/components/UserAvatars';

const TitleBar: React.FC = () => {
    return (
        <header className='w-full bg-white border-b border-gray-200 px-4 py-2 shadow-sm'>
            <div className='mx-auto flex items-center gap-3'>
                <div className='flex-shrink-0'>
                    <img
                        src='/KULEUVEN_CMYK_LOGO.png'
                        alt='logo'
                        className='h-12 w-auto'
                    />
                </div>
                <div className='flex-shrink-0'>
                    <img
                        src='/UHasselt-liggend.png'
                        alt='logo'
                        className='h-12 w-auto'
                    />
                </div>

                <div className='flex flex-col justify-center'>
                    <h1 className='text-xl font-semibold text-gray-800 leading-tight'>
                        Scene-aware Collaborative 3D Editor
                    </h1>

                    <nav className='w-fit'>
                        <Menu />
                    </nav>
                </div>

                <div className='ml-auto flex items-center gap-4'>
                    <UserAvatars />
                    <Button 
                        variant="secondary" 
                        size="lg" 
                        className='bg-slate-200 hover:bg-slate-300'
                        onClick={() => {
                            window.open("https://github.com/CTRL-Florian/Bachelorproef-Scene-aware-Collaborative-3D-Editor", "_blank", "noreferrer")
                        }}
                    >
                        Source
                        <Avatar>
                            <AvatarImage src="https://avatars.githubusercontent.com/u/181760690?v=4&size=64" />
                            <AvatarFallback>S</AvatarFallback>
                        </Avatar>
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default TitleBar;