import ViewPort from '@/playground/ViewPort';

const Playground: React.FC = () => {
    return (
        <>
            <div className='w-full h-full flex mx-auto items-center'>
                <div className='flex-grow h-full'>
                    <ViewPort />
                </div>
                
            </div>
        </>
    );
};

export default Playground;
